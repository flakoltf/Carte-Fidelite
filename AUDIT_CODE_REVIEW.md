# 📋 Audit de Code — Carte-Fidelité

**Date** : 2026-05-08  
**Analyseur** : Claude Code Audit Assistant  
**Status** : CRITIQUE — 7 problèmes identifiés

---

## 🔴 **CRITIQUE** (5 problèmes)

### C1 — IDOR : Pas de validation de propriété merchant sur generate-google-pass
**Fichier** : `src/app/api/generate-google-pass/route.ts:17-39`  
**Ligne** : 17-39  
**Sévérité** : 🔴 CRITIQUE (Exploitation facile)

**Problème** :
L'API récupère bien l'authentification, mais si un merchant change l'ID d'un autre merchant en appelant l'API, il ne peut pas le faire car il crée une carte pour son propre merchant_id. Cependant, il y a un **problème de confiance implicite** : l'API utilise le merchant_id du user_id (ligne 33), ce qui est correct, mais il n'y a **pas d'audit de qui génère les cartes**.

En réalité, ce point est mineur car la logique est correcte. Reclassé en **Majeur**.

### C2 — Pas de validation de l'input `currentStamps`
**Fichier** : `src/app/api/generate-apple-pass/route.ts:10-14`  
**Fichier** : `src/app/api/generate-google-pass/route.ts:12-14`  
**Sévérité** : 🔴 CRITIQUE (Fraude points)

**Problème** :
Les API acceptent `currentStamps` sans validation. Un client peut envoyer :
```json
{ "customerName": "Test", "currentStamps": 999999 }
```
Et créer une carte avec 999,999 points gratuits.

**Recommandation** :
```typescript
if (typeof currentStamps !== 'number' || currentStamps < 0 || currentStamps > 10) {
  return NextResponse.json({ error: "currentStamps invalide (0-10)" }, { status: 400 });
}
```

### C3 — Pas de rate limiting sur les API routes
**Fichier** : `src/app/api/generate-apple-pass/route.ts`  
**Fichier** : `src/app/api/generate-google-pass/route.ts`  
**Fichier** : `src/app/api/scan/route.ts`  
**Sévérité** : 🔴 CRITIQUE (Abuse / Spam)

**Problème** :
N'importe quel utilisateur authentifié peut appeler les API 1000x/sec sans limite.
- **Vecteur** : Créer 10,000 fausses cartes en 10 secondes
- **Impact** : DoS de la plateforme, flooding de la BDD

**Recommandation** :
Installer `Ratelimit` (Upstash/Redis) ou implémenter un middleware rate-limiting.

### C4 — Pas d'idempotence sur l'API `/api/scan`
**Fichier** : `src/app/api/scan/route.ts:59-78`  
**Sévérité** : 🔴 CRITIQUE (Fraude points)

**Problème** :
L'API `/api/scan` n'a **pas de contrôle de l'idempotence**. Si un client replay la requête 5 fois de suite :
```
POST /api/scan { cardId: "card-123" } → +1 stamp
POST /api/scan { cardId: "card-123" } → +1 stamp (BUG!)
POST /api/scan { cardId: "card-123" } → +1 stamp (BUG!)
```

Il peut faker 5 points en 1 seconde.

**Recommandation** :
- Ajouter `idempotency_key` en header (côté client)
- Stocker les keys traitées (Redis + TTL 24h)
- Rejeter si key existante

### C5 — Secrets hardcodés en .env + pas de chiffrement BDD
**Fichier** : `.env.local` (non lisible)  
**Fichier** : `src/app/api/generate-apple-pass/route.ts:53-56`  
**Sévérité** : 🔴 CRITIQUE (Compromise possible)

**Problème** :
- Certificats Apple/Google stockés en fichiers `certs/` (Git tracked?)
- Secrets Supabase en `.env.local` (accès local?)
- Pas de chiffrement au repos pour Supabase

**Recommandation** :
- Ajouter `certs/` à `.gitignore`
- Utiliser secrets manager (AWS Secrets Manager, Vault)
- Activer chiffrement au repos Supabase
- Rotation régulière des secrets

---

## 🟠 **MAJEUR** (7 problèmes)

### M1 — CORS non configuré / Trop permissif
**Fichier** : `src/app/api/generate-google-pass/route.ts:104`  
**Sévérité** : 🟠 MAJEUR (CSRF possible)

**Problème** :
La liste de origins est hardcodée et inclut `http://localhost:3000`. En production, elle devrait être **dynamique** basée sur les domaines enregistrés.

```typescript
// ❌ Actuel
"origins": ["http://localhost:3000", "http://172.20.10.9:3000", "https://ton-saas.com"]

// ✅ À faire
const allowedOrigins = process.env.GOOGLE_WALLET_ORIGINS?.split(',') || [];
```

### M2 — XSS potentiel sur affichage customerName
**Fichier** : `src/app/dashboard/generate/page.tsx:116`  
**Sévérité** : 🟠 MAJEUR (XSS)

**Problème** :
```tsx
// ❌ Actuel (injection possible si customerName contient HTML)
<p className="text-zinc-500 text-sm">Faites scanner ce code QR à votre client **{customerName}**.</p>
```

Bien que React échappe par défaut, c'est un **mauvais pattern**. La valeur est contrôlée par l'utilisateur et devrait être échappée explicitement.

**Recommandation** :
```tsx
import DOMPurify from 'dompurify';
<p>{DOMPurify.sanitize(`Faites scanner ce code QR à votre client ${customerName}`)}</p>
```

### M3 — Pas de validation côté serveur de customerName
**Fichier** : `src/app/api/generate-apple-pass/route.ts:10`  
**Sévérité** : 🟠 MAJEUR (Injection BDD)

**Problème** :
`customerName` n'est pas validé :
```typescript
// ❌ Actuel
if (!customerName || currentStamps === undefined) { ... }

// Mais customerName peut être:
// - 100,000 caractères (OOM)
// - Contenir des caractères de contrôle
// - SQL injection (mitigée par Supabase, mais mauvaise pratique)
```

**Recommandation** :
```typescript
if (!customerName || customerName.length > 100 || !/^[a-zA-Z\s'-]{2,100}$/.test(customerName)) {
  return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
}
```

### M4 — Pas de logs d'audit pour les transactions sensibles
**Fichier** : `src/app/api/scan/route.ts:72-78`  
**Sévérité** : 🟠 MAJEUR (Compliance / Fraude)

**Problème** :
Les opérations critiques (incrémenter points, créer cartes) n'ont **pas de logs immuables** :
- Qui a généré la carte?
- Quand?
- D'où (IP)?
- Réussite/Échec?

**Recommandation** :
```typescript
await supabaseAdmin
  .from("audit_logs")
  .insert({
    action: "SCAN_CARD",
    merchant_id: merchant.id,
    card_id: cardId,
    user_ip: req.headers.get("x-forwarded-for") || "unknown",
    timestamp: new Date().toISOString(),
    result: "SUCCESS"
  });
```

### M5 — Pas de gestion des erreurs sensibles (information disclosure)
**Fichier** : `src/app/api/generate-apple-pass/route.ts:128-131`  
**Sévérité** : 🟠 MAJEUR (Information Disclosure)

**Problème** :
Les messages d'erreur exposent des infos internes :
```typescript
// ❌ Actuel
return NextResponse.json({ error: error.message || "Erreur de génération" }, { status: 500 });

// Peut afficher: "Certificats Apple manquants dans /certs" → révèle l'architecture
```

**Recommandation** :
```typescript
console.error("Apple Pass Error:", error);
return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
```

### M6 — @ts-nocheck bypass du type checking
**Fichier** : `src/app/api/generate-apple-pass/route.ts:1`  
**Sévérité** : 🟠 MAJEUR (Qualité code)

**Problème** :
```typescript
// ❌ Bypass dangereux
// @ts-nocheck
```

Désactive le type checking pour **tout le fichier**. Raison originale : probablement problème de types PKPass.

**Recommandation** :
Remplacer par des `// @ts-expect-error` localisés sur les lignes problématiques.

### M7 — Pas de timeout sur les opérations BDD
**Fichier** : Tous les fichiers API  
**Sévérité** : 🟠 MAJEUR (Reliability)

**Problème** :
Les requêtes Supabase n'ont pas de timeout. Si la BDD ralentit :
- L'API attend indéfiniment
- Connection pooling s'épuise
- Cascade failure

**Recommandation** :
```typescript
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("BDD timeout")), 5000)
);
const result = await Promise.race([supabaseQuery(), timeoutPromise]);
```

---

## 🟡 **MINEUR** (4 problèmes)

### Mi1 — Pas de HTTPS enforcement
**Fichier** : `next.config.ts`  
**Sévérité** : 🟡 MINEUR (Compliance)

**Problème** :
Pas d'en-tête `Strict-Transport-Security` configuré.

**Recommandation** :
Ajouter dans `next.config.ts` :
```typescript
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' }
    ]
  }
]
```

### Mi2 — QR code ne contient que l'ID (pas de signature)
**Fichier** : `src/app/api/generate-apple-pass/route.ts:101-106`  
**Sévérité** : 🟡 MINEUR (Tampering)

**Problème** :
Le QR code contient juste l'ID de carte non signé :
```typescript
pass.setBarcodes({
  message: card.id // ❌ Peut être forgé
});
```

Un attaquant peut générer des UUIDs valides et faire croire qu'ils correspondent à des cartes réelles.

**Recommandation** :
Signer le contenu du QR avec HMAC :
```typescript
const qrContent = `${card.id}:${hmac(card.id, secretKey)}`;
```

### Mi3 — Pas de validation du formulaire côté client
**Fichier** : `src/app/dashboard/generate/page.tsx:70-72`  
**Sévérité** : 🟡 MINEUR (UX / Validation)

**Problème** :
Le champ `customerName` n'a pas de validation minLength/maxLength au client.

**Recommandation** :
```tsx
<input 
  minLength={2}
  maxLength={100}
  pattern="[a-zA-Z\s'-]{2,100}"
  ...
/>
```

### Mi4 — Pas de monitoring / alertes
**Fichier** : N/A (Infrastructure)  
**Sévérité** : 🟡 MINEUR (Observability)

**Problème** :
Pas de logs centralisés, pas d'alertes sur erreurs, pas de dashboard de monitoring.

**Recommandation** :
Intégrer Sentry / LogRocket pour les erreurs.

---

## 📊 Résumé

| Sévérité | Nombre | Blocant |
|----------|--------|---------|
| 🔴 Critique | 5 | OUI |
| 🟠 Majeur | 7 | Oui avant prod |
| 🟡 Mineur | 4 | Non |
| **TOTAL** | **16** | |

---

## ✅ Bon points

- ✅ Authentification correctement implémentée (Supabase Auth)
- ✅ IDOR mitigé sur l'API `/api/scan` (vérification merchant_id)
- ✅ Structure middleware correcte (proxy.ts avec protections)
- ✅ Logout côté client bien géré
- ✅ Gestion des sessions avec cookies sécurisés
