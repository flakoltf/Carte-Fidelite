# Comptes de démonstration

> ⚠️ Ce fichier ne contient **aucun mot de passe en clair**. Les mots de passe sont
> fournis via variables d'environnement au moment de l'exécution des scripts, jamais commités.

## Compte MARCHAND démo

- **Email** : `demo@walletcard.app`
- **Mot de passe** : défini hors-repo (voir `scripts/seed-demo-merchant.mjs` et la variable d'env du script).
- **Connexion** : `/login`
- Données d'exemple semées en base (analytique). Recréé/réinitialisé par `scripts/seed-demo-merchant.mjs`.

## Compte ADMIN démo  — 🗑️ TEMPORAIRE, À SUPPRIMER PLUS TARD

- **Email** : `admin-demo@walletcard.app`
- **Mot de passe** : **non stocké ici**. Défini à l'exécution via la variable d'env
  `DEMO_ADMIN_PASSWORD` (ex. `DEMO_ADMIN_PASSWORD='...' node scripts/reset-demo-admin-password.mjs`).
- **Connexion** : `/login` puis accès `/admin`
- Créé/promu admin par `scripts/bootstrap-admin.mjs` (avec `ADMIN_EMAIL=admin-demo@walletcard.app`).
- Mot de passe (ré)initialisé par `scripts/reset-demo-admin-password.mjs` (exige `DEMO_ADMIN_PASSWORD`).
- **IDs** (base prod Supabase `oqcelbbozpykwkasjtqy`) :
  - user_id (auth) : `9d9a1691-eb03-40e8-8c7a-5265fb1731e2`
  - merchants.id : `576161cc-0743-4d69-99e4-30ffa5de56a5`

> ⚠️ **Sécurité** : l'ancien mot de passe de ce compte (`admin-demo-…-2026`) a été committé
> par le passé dans ce repo → il est **considéré comme compromis** et doit être **roté ou le
> compte supprimé** (cf. procédure ci-dessous). Voir `docs/security/AUDIT-2026-06-04.md` (SEC-10).

### Pour le SUPPRIMER quand on n'en aura plus besoin

1. Supprimer la ligne `merchants` : `DELETE FROM merchants WHERE id = '576161cc-0743-4d69-99e4-30ffa5de56a5';`
2. Supprimer l'utilisateur Auth via le dashboard Supabase (Authentication → Users → `admin-demo@walletcard.app` → Delete), ou via l'API admin `auth.admin.deleteUser('9d9a1691-eb03-40e8-8c7a-5265fb1731e2')`.
3. Retirer ce compte de ce fichier.

---

> Vrai compte admin (le tien) : ton email personnel (mot de passe défini à la 1ʳᵉ connexion, non stocké ici).
