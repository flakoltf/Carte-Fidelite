# Comptes de démonstration

> ⚠️ Ce fichier contient des mots de passe en clair. Repo privé uniquement.
> Ne pas exposer publiquement. Ne pas réutiliser ces mots de passe ailleurs.

## Compte MARCHAND démo

- **Email** : `demo@walletcard.app`
- **Mot de passe** : `demo-walletcard-2026`
- **Connexion** : `/login`
- Données d'exemple semées en base (analytique). Recréé/réinitialisé par `scripts/seed-demo-merchant.mjs`.

## Compte ADMIN démo  — 🗑️ TEMPORAIRE, À SUPPRIMER PLUS TARD

- **Email** : `admin-demo@walletcard.app`
- **Mot de passe** : `admin-demo-walletcard-2026`
- **Connexion** : `/login` puis accès `/admin`
- Créé/promu admin par `scripts/bootstrap-admin.mjs` (avec `ADMIN_EMAIL=admin-demo@walletcard.app`).
- Mot de passe (ré)initialisé par `scripts/reset-demo-admin-password.mjs`.
- **IDs** (base prod Supabase `oqcelbbozpykwkasjtqy`) :
  - user_id (auth) : `9d9a1691-eb03-40e8-8c7a-5265fb1731e2`
  - merchants.id : `576161cc-0743-4d69-99e4-30ffa5de56a5`

### Pour le SUPPRIMER quand on n'en aura plus besoin

1. Supprimer la ligne `merchants` : `DELETE FROM merchants WHERE id = '576161cc-0743-4d69-99e4-30ffa5de56a5';`
2. Supprimer l'utilisateur Auth via le dashboard Supabase (Authentication → Users → `admin-demo@walletcard.app` → Delete), ou via l'API admin `auth.admin.deleteUser('9d9a1691-eb03-40e8-8c7a-5265fb1731e2')`.
3. Retirer ce compte de ce fichier.

---

> Vrai compte admin (le tien) : `thealphawa@gmail.com` (mot de passe défini à la 1ʳᵉ connexion, non stocké ici).
