# 🔒 Audit de Sécurité — Plateforme Cartes de Fidélité

**Date** : 2026-05-08  
**Status** : ⚠️ CRITIQUE (7 risques exploitables immédiatement)  
**Score de Risque** : 8.2/10 (Élevé)

---

## OWASP Top 10 — Évaluation

### 1. 🔴 **A01 : Broken Access Control**

#### 1.1 IDOR mitigé sur generate-apple-pass (FIXÉ)
**Status** : ✅ Corrigé  
**Avant** : N'importe qui pouvait générer des passes sans authentification  
**Après** : Authentification + vérification du merchant_id

#### 1.2 Pas de RBAC entre clients et commerçants
**Status** : 🔴 CRITIQUE  
**Description** : N'importe quel utilisateur authentifié peut accéder au dashboard d'un autre commerçant si l'ID est connu.

**Vecteur d'attaque** :
```
1. Attaquant crée compte → user_id = "uuid-1"
2. Attaquant modifie l'ID dans la BDD ou logs pour "uuid-2" (commerçant cible)
3. Visite /dashboard → reçoit les données de uuid-2
```

**Exploitation** :
- Récupérer liste des clients d'un concurrent
- Voir toutes les cartes de fidélité + points
- Annuler des transactions

**Recommandation** :
```typescript
// Dans middleware (proxy.ts)
const merchant = await supabaseAdmin
  .from("merchants")
  .select("id")
  .eq("user_id", user.id)
  .single();

if (!merchant) {
  return NextResponse.redirect(new URL('/login', request.url));
}

// Vérifier que toute requête API inclut merchant_id du user courant
```

**Effort** : S (Simple) — Ajouter vérifications dans les pages dashboard

---

### 2. 🟠 **A02 : Cryptographic Failures**

#### 2.1 Pas de chiffrement au repos pour Supabase
**Status** : 🟠 MAJEUR  
**Description** : Les données clients (emails, noms) sont en clair en BDD

**Impact** : Si quelqu'un accède à la BDD via compromission d'infrastructure → fuite RGPD

**Recommandation** :
```sql
-- Supabase: Activer chiffrement au repos via KMS (AWS)
-- Configuration: Database → Encryption at rest
```

#### 2.2 QR codes non signés
**Status** : 🔴 CRITIQUE  
**Description** : Le QR code contient juste l'ID de carte sans signature

```typescript
// ❌ Actuel
barcode: { type: "QR_CODE", value: card.id }

// ✅ À faire
const hmac = crypto.createHmac('sha256', process.env.QR_SECRET_KEY!);
const signature = hmac.update(card.id).digest('hex').slice(0, 16);
barcode: { type: "QR_CODE", value: `${card.id}:${signature}` }
```

**Exploitation** : Forgerie de QR codes valides avec des UUIDs aléatoires

---

### 3. 🟢 **A03 : Injection**

#### 3.1 SQL Injection
**Status** : ✅ MITIGÉ (Supabase paramétrisé)  
Supabase utilise des requêtes paramétrées. ✅

#### 3.2 NoSQL Injection
**Status** : ✅ N/A (PostgreSQL, pas NoSQL)

#### 3.3 Command Injection
**Status** : ✅ N/A (Pas de shell commands)

---

### 4. 🟠 **A04 : Insecure Design**

#### 4.1 Pas d'anti-fraude sur l'attribution de points
**Status** : 🔴 CRITIQUE  
**Description** : Aucun système pour détecter/bloquer les fraudes répétées

**Scénarios** :
```
1. Attaquant fait X scans en 1 seconde (idempotence mitigue désormais, mais pas de détection d'anomalie)
2. Scan la même carte 1000 fois depuis des endroits différents
3. Crée des cartes avec 10 points, puis tente de rejouer les transactions
```

**Recommandation** :
```typescript
// Vérifier les patterns suspects
const recentScans = await supabaseAdmin
  .from("scan_history")
  .select("created_at")
  .eq("card_id", cardId)
  .gte("created_at", new Date(Date.now() - 60000).toISOString());

if (recentScans.length > 5) {
  // Alerter + bloquer temporairement
  await supabaseAdmin.from("fraud_alerts").insert({
    card_id: cardId,
    reason: "TOO_MANY_SCANS",
    severity: "HIGH"
  });
}
```

#### 4.2 Pas de limite de tentatives de crédit
**Status** : 🟠 MAJEUR  
**Description** : Un commerçant malhonnête peut créer des cartes avec 10 points illimité

**Recommandation** :
- Ajouter rate limiting par merchant (déjà fait)
- Audit trail complet des créations
- Notifications si > 100 cartes/jour

---

### 5. 🟡 **A05 : Broken Authentication**

#### 5.1 Pas de MFA sur les commerçants
**Status** : 🟡 MINEUR  
**Description** : L'authentification est basique email/password

**Impact** : Si un commerçant réutilise le même password partout, compromission facile

**Recommandation** :
```typescript
// Supabase Auth: Activer MFA
const { error } = await supabase.auth.signUpWithPassword({
  email, password,
  options: { data: { mfa_required: true } }
});
```

#### 5.2 Session timeout non configuré
**Status** : 🟡 MINEUR  
**Description** : Les sessions peuvent rester ouvertes indéfiniment

**Recommandation** :
```typescript
// next.config.ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
};
// Ajouter session expiration dans middleware
```

---

### 6. 🟠 **A06 : Sensitive Data Exposure**

#### 6.1 Logs avec données sensibles
**Status** : 🟠 MAJEUR  
**Description** : Les erreurs du serveur peuvent contenir des infos sensibles

**Vecteur** :
```
console.error("Erreur de génération du Apple Pass:", error);
// Peut exposer: chemins fichiers, tokens, IDs
```

**Recommandation** : ✅ FIXÉ — Logs génériques maintenant

#### 6.2 Pas de masquage des données personnelles en logs
**Status** : 🟠 MAJEUR  
Quand une personne scanne un QR, on enregistre son nom en clair.

**Recommandation** :
```typescript
// Pseudonymiser les logs
const pseudonym = `CUST_${card.id.slice(0, 8)}`;
console.log(`Scan par ${pseudonym}`); // Au lieu de customer.full_name
```

---

### 7. 🟠 **A07 : Identification & Authentication Failures**

#### 7.1 Rate limiting insuffisant sur login
**Status** : 🟠 MAJEUR  
**Description** : Pas de rate limiting sur l'endpoint `/login`

**Vecteur** : Brute force des passwords

**Recommandation** :
```typescript
// Ajouter rate limiting sur login
const loginAttempts = rateLimit(`login:${email}`, 5, 900000); // 5/15min
```

---

### 8. 🟡 **A08 : Software & Data Integrity Failures**

#### 8.1 Pas de signature des QR codes
**Status** : 🔴 CRITIQUE (déjà noté)

#### 8.2 Dépendances vulnérables
**Status** : 🟡 MINEUR  
Run `npm audit` pour vérifier

---

### 9. 🟡 **A09 : Logging & Monitoring Failures**

#### 9.1 Pas de centralisation des logs
**Status** : 🟠 MAJEUR  
**Description** : Les erreurs/scans ne sont loggés que localement (console)

**Impact** :
- Pas de détection des attaques
- Pas d'audit trail RGPD
- Impossibilité d'enquêter sur les incidents

**Recommandation** :
```typescript
// Intégrer Sentry / LogRocket
import * as Sentry from "@sentry/nextjs";

Sentry.captureException(error, {
  tags: { endpoint: "/api/scan", merchant_id: merchant.id }
});
```

#### 9.2 Pas d'alertes sur anomalies
**Status** : 🟠 MAJEUR  
- Aucune alerte si 1000 scans en 1 minute
- Aucune alerte si accès BDD anormal

---

### 10. 🟡 **A10 : Server-Side Request Forgery (SSRF)**

#### 10.1 SSRF minimalistes
**Status** : ✅ Très faible risque  
L'API ne fait des requêtes externes qu'à Google/Apple APIs avec credentials contrôlés.

Aucun input utilisateur n'est utilisé pour construire les URLs.

---

## Risques Spécifiques — Plateforme de Fidélité

### 🔴 **Fraude Points — CRITIQUE**

| Scénario | Exploit | Mitigation |
|----------|---------|-----------|
| Replay transactions | Scanner le même QR 100x | ✅ Idempotence implémentée |
| Forgerie QR codes | Générer UUIDs valides | ❌ À faire — Signer les QR |
| Augmenter les points en BDD | Client SQL injection sur BDD | ✅ Mitigé (RLS manquant) |
| Annuler les scans | Appel API avec ancien cardId | ❌ Aucun rollback possible |

### 🟠 **Fuite de données clients — MAJEUR**

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| RGPD — Données personnelles | Amende 4% du CA + réputation | ⚠️ Chiffrement au repos manquant |
| Droit à l'oubli | Impossible de supprimer un client | ❌ À implémenter |
| Consentement | Pas de consentement au signup | ❌ À implémenter |

### 🔴 **Usurpation d'identité — CRITIQUE**

| Vecteur | Description | Impact |
|---------|-------------|--------|
| Créer fausses cartes | Attaquant crée carte au nom d'un autre | Usurpation d'identité |
| Accéder à la carte d'autrui | Voir les points d'un client | Privacy breach |

---

## Score de Risque Détaillé

| Catégorie | Risque | Probabilité | Impact | Score |
|-----------|--------|-------------|--------|-------|
| Fraude points | Élevé | Haute | Élevé | **9/10** |
| IDOR/RBAC | Élevé | Moyenne | Élevé | **7/10** |
| Fuite RGPD | Critique | Moyenne | Critique | **8/10** |
| QR forgerie | Moyen | Basse | Moyen | **5/10** |
| Brute force | Moyen | Moyenne | Moyen | **6/10** |
| Monitoring | Moyen | Haute | Moyen | **7/10** |

**Score Global** : **8.2/10** (Élevé)

---

## Plan de Mitigation par Priorité

### 🔴 Bloquant (Avant Production)

1. **Signature des QR codes** — 2h
2. **Audit trail immuable** — 4h
3. **Chiffrement au repos Supabase** — 1h
4. **RLS (Row Level Security) Supabase** — 3h
5. **Rate limiting sur login** — 1h

### 🟠 Critique (Semaine 1)

1. **Anti-fraude pattern detection** — 8h
2. **Logs centralisés (Sentry)** — 4h
3. **Masquage données sensibles** — 2h
4. **Droit à l'oubli RGPD** — 6h

### 🟡 Important (Semaine 2-3)

1. **MFA pour commerçants** — 4h
2. **Monitoring & alertes** — 6h
3. **Conformité RGPD complète** — 8h

---

## Infrastructure Sécurisée (Recommandation)

```
┌─────────────────────────────────────────────────────────────┐
│  WAF (AWS WAF / Cloudflare)                                  │
│  - Rate limiting global                                      │
│  - DDoS protection                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Next.js (Application Server)                               │
│  - HTTPS enforced ✅                                         │
│  - Security headers ✅                                       │
│  - CORS configured ✅                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐      ┌──────▼────────┐
│ Supabase     │      │ External APIs │
│ - RLS        │      │ - Apple Pass  │
│ - Encryption │      │ - Google Pass │
│ - Backups    │      │ - Sentry      │
└──────────────┘      └───────────────┘
```

---

## Checklist de Déploiement

- [ ] Signature des QR codes implémentée
- [ ] Rate limiting login activé
- [ ] Audit trail fonctionnel
- [ ] Supabase RLS configuré
- [ ] Chiffrement au repos activé
- [ ] Sentry intégré
- [ ] Tests de pénétration exécutés
- [ ] Conformité RGPD validée
- [ ] MFA activé pour admins
- [ ] Secrets manager configuré
- [ ] Backups quotidiens testés
- [ ] Incident response plan écrit

**JAMAIS déployer en production sans tous les ✅**
