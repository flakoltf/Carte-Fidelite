# 🗺️ Roadmap — Cartes de Fidélité

**Last Updated** : 2026-05-08  
**Projet Status** : Alpha (corrections de sécurité en cours)

---

## 🔴 **Bloquant — Production (Semaine 1)**

### B1 — Signature des QR codes
**Description** : QR codes actuellement non signés → peuvent être forgés  
**Effort** : S (2-3h)  
**Dépendances** : Aucune  
**Ordre** : #1 (Dépend de : rien)  
**Détail** :
```typescript
// Ajouter HMAC signature aux QR codes
// Vérifier la signature côté backend avant validating scan
// Coût: ~50 lignes de code
```

### B2 — Audit Trail Immuable
**Description** : Logs centralisés des toutes les transactions de points  
**Effort** : M (4-6h)  
**Dépendances** : B1  
**Ordre** : #2  
**Détail** :
- Table `audit_logs` avec structure immuable
- Tous les scans, créations, suppressions loggées
- Logs chiffrés au repos

### B3 — RLS (Row Level Security) Supabase
**Description** : Empêcher un commerçant d'accéder aux données d'un autre  
**Effort** : M (3-4h)  
**Dépendances** : Aucune  
**Ordre** : #3  
**Détail** :
```sql
-- Exemple
CREATE POLICY "Commerçants ne voient que leurs cartes"
ON loyalty_cards FOR SELECT
USING (merchant_id = auth.uid());
```

### B4 — Chiffrement au repos Supabase
**Description** : Activer KMS encryption sur les données  
**Effort** : S (1h)  
**Dépendances** : Aucune (infrastructure)  
**Ordre** : #4  
**Détail** : Configuration Supabase → Database → Encryption  

### B5 — Rate limiting sur Login
**Description** : Protéger contre brute force passwords  
**Effort** : S (1-2h)  
**Dépendances** : Aucune  
**Ordre** : #5  
**Détail** :
```typescript
// Ajouter rate limiting: 5 tentatives / 15 min par email
```

---

## 🟠 **Important — Lancement Commerçants (Semaine 1-2)**

### I1 — Anti-fraude Pattern Detection
**Description** : Détecter les patterns suspects (scans répétés, multiples adresses IP, etc.)  
**Effort** : L (6-8h)  
**Dépendances** : B2 (audit logs)  
**Ordre** : #6  
**Détail** :
- Algorithme de détection anomalies (ML optional)
- Seuils : > 5 scans/min, scans depuis pays différents, etc.
- Alertes email au commerçant

### I2 — Logs Centralisés (Sentry)
**Description** : Monitoring erreurs et incidents  
**Effort** : M (3-4h)  
**Dépendances** : Aucune  
**Ordre** : #7  
**Détail** :
```bash
npm install @sentry/nextjs
# Configuration dans next.config.ts
```

### I3 — Masquage Données Sensibles en Logs
**Description** : Ne pas logger les noms complets, masquer emails  
**Effort** : S (2h)  
**Dépendances** : I2  
**Ordre** : #8  

### I4 — Dashboard pour Commerçants
**Description** : Vue de gestion complète : clients, points, récompenses, statistiques  
**Effort** : L (12-16h)  
**Dépendances** : B3 (RLS)  
**Ordre** : #9  
**Features** :
- Liste clients avec points
- Export CSV
- Graphiques de fidélité
- Bulk create cartes
- Historique des scans

### I5 — Notifications par Email
**Description** : Notifier les clients quand ils gagnent/perdent des points  
**Effort** : M (4-6h)  
**Dépendances** : Aucune  
**Ordre** : #10  
**Détail** :
- SendGrid / Mailgun integration
- Templates HTML
- Unsubscribe support

### I6 — RGPD — Droit à l'Oubli
**Description** : Permettre suppression complète des données d'un client  
**Effort** : M (4-6h)  
**Dépendances** : B2, I1  
**Ordre** : #11  
**Détail** :
- Endpoint DELETE /api/customers/{id}
- Supprime : données perso, cartes, scans, logs associés
- Logs de suppression pour audit

### I7 — Authentification Multi-Facteur (MFA)
**Description** : TOTP/SMS 2FA pour commerçants  
**Effort** : M (4-5h)  
**Dépendances** : Aucune  
**Ordre** : #12  
**Détail** : Supabase Auth + `react-otp-input`

### I8 — Statistiques en Temps Réel
**Description** : Dashboard avec KPIs : taux activation, points moyens, récompenses  
**Effort** : M (6-8h)  
**Dépendances** : B2, I4  
**Ordre** : #13  

---

## 🟡 **Nice-to-Have — V2+ (Mois 2-3)**

### N1 — API Publique pour Commerçants
**Description** : Webhook + REST API pour intégrations externes  
**Effort** : L (8-10h)  
**Dépendances** : B1, B2, B3  
**Ordre** : #14 (Optionnel)  
**Exemple** :
```
POST https://api.walletcard.com/webhooks/scan
{
  "event": "card.scanned",
  "merchant_id": "...",
  "card_id": "...",
  "timestamp": "2026-05-08T10:30:00Z"
}
```

### N2 — Program de Récompenses Avancé
**Description** : Niveaux, objectifs spéciaux, récompenses temporelles  
**Effort** : L (10-12h)  
**Dépendances** : I4  
**Exemple** :
- Tier 1 : 1 point/achat
- Tier 2 (après 50 points) : 1.5 points/achat
- Event spécial (Black Friday) : 2x points

### N3 — Push Notifications
**Description** : Notifier les clients via Apple/Google Wallet quand points changent  
**Effort** : M (5-6h)  
**Dépendances** : Apple/Google Push APIs  

### N4 — Intégrations POS
**Description** : Plugin pour Shopify, WooCommerce, Square, etc.  
**Effort** : L (12h+ par POS)  
**Dépendances** : N1 (API Publique)  

### N5 — Mobile App Native
**Description** : App iOS/Android (actuellement web-based)  
**Effort** : XL (40h+)  
**Stack** : React Native / Flutter  
**Dépendances** : Aucune (mais B1-I8 en priorité)  

### N6 — Machine Learning pour Fraude
**Description** : Détection comportementale avancée des fraudes  
**Effort** : L (10h+)  
**Stack** : Python + TensorFlow / scikit-learn  
**Dépendances** : B2 (données historiques)  

### N7 — Conversion to Rewards
**Description** : Permettre d'échanger points contre produits/réductions  
**Effort** : M (6-8h)  
**Dépendances** : I4  

---

## Timeline Recommandée

### Sprint 1 (Semaine 1)
- ✅ Corrections sécurité (Phase 3-4)
- [ ] B1 — Signature QR
- [ ] B2 — Audit Trail
- [ ] B3 — RLS
- [ ] B4 — Encryption
- [ ] B5 — Rate limiting login

### Sprint 2 (Semaine 2)
- [ ] I1 — Anti-fraude
- [ ] I2 — Sentry
- [ ] I3 — Masquage données
- [ ] I4 — Dashboard commerçants

### Sprint 3 (Semaine 3)
- [ ] I5 — Notifications email
- [ ] I6 — Droit à l'oubli
- [ ] I7 — MFA
- [ ] I8 — Stats temps réel

### Sprint 4+ (Mois 2)
- [ ] N1 — API Publique
- [ ] N2 — Récompenses avancées
- [ ] N3 — Push Notifications

---

## Dépendances Critiques

```
B5 (Rate Login)
  ↓
I2 (Sentry) ← B2 (Audit)
  ↓
I4 (Dashboard) ← B3 (RLS)
  ↓
N1 (API) ← B1 (QR Signature)
  ↓
N4 (POS Integration)
```

**Chemin critique** : B5 → I2 → I4 → N1 → N4  
**Durée estimée** : 4-5 semaines pour launch MVP complet

---

## Ressources Nécessaires

| Tâche | Skills | Estimation |
|-------|--------|-----------|
| B1-B5, I1-I3 | Backend Node.js + TypeScript | 3 dev-semaines |
| I4-I7 | Frontend React + UX/UI | 2-3 dev-semaines |
| I2, I5 | DevOps + Intégrations | 1 dev-semaine |
| Testing | QA | 1 dev-semaine |
| **Total** | | **7-8 dev-semaines** |

---

## Budget Estimation

| Service | Cost | Status |
|---------|------|--------|
| Supabase (Scale) | $500-2000/mth | ✅ Configurable |
| Sentry Pro | $200/mth | À évaluer |
| SendGrid | $100/mth (volum) | ✅ Optional |
| AWS Secrets Manager | $50-200/mth | À budget |
| Infra (servers) | $200-500/mth | À budget |
| **Total** | **$1050-3250/mth** | |

---

## Success Metrics (Post-Launch)

- [ ] 0 frauds points (< 1%)
- [ ] 99.9% uptime
- [ ] < 2s card generation
- [ ] < 500ms scan response
- [ ] 0 RGPD violations
- [ ] 100% audit trail
- [ ] NPS > 8.5 (commerçants)
