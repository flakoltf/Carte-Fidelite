# MFA marchand (2FA TOTP, optionnel) — Design

**Date :** 2026-06-03
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)
**Contexte :** les comptes marchands n'ont qu'un facteur (mot de passe). Un mot de passe volé = accès à toutes les données clients. On ajoute une **double authentification optionnelle** par application d'authentification (TOTP), via le **MFA natif de Supabase Auth** (gratuit, pas de SMS).

## Objectif

Permettre à un marchand d'**activer lui-même** une 2FA (code à 6 chiffres d'une appli type Google/Microsoft Authenticator) dans ses Réglages. Une fois active, sa connexion exige le code après le mot de passe. **Optionnel** : un marchand qui n'active rien continue avec email + mot de passe.

## Décisions validées (brainstorming)

1. **TOTP (appli d'authentification)** uniquement — pas de SMS/email (coût/complexité).
2. **Optionnel**, activé par chaque marchand dans Réglages → Sécurité. Aucun blocage des comptes existants.
3. **Récupération en cas de perte du téléphone** : l'**admin** retire le facteur côté Supabase (le compte et **toutes les données restent intacts** — elles ne sont jamais liées au mot de passe/2FA). **Pas de codes de secours** en v1.
4. **Désactivation** par le marchand depuis Réglages (Supabase exige une session déjà vérifiée AAL2).
5. Logique d'éligibilité **pure et testée** ; audit `MFA_ENROLLED` / `MFA_DISABLED`.

## Concepts Supabase (rappel)

Supabase Auth gère le MFA TOTP nativement, avec deux niveaux d'assurance :
- **AAL1** = mot de passe vérifié.
- **AAL2** = mot de passe **+** code TOTP vérifié.
Après `signInWithPassword`, si le marchand a un facteur TOTP **vérifié**, la session est AAL1 et doit « monter » en AAL2 via un *challenge + verify*. `getAuthenticatorAssuranceLevel()` renvoie `{ currentLevel, nextLevel }` ; un step-up est requis quand `currentLevel === 'aal1' && nextLevel === 'aal2'`.

## Périmètre

**Inclus** : section Sécurité dans Réglages (activer/désactiver TOTP avec QR + confirmation par code), page d'étape MFA à la connexion (`/login/mfa`), enforcement dans `proxy.ts`, logique pure testée (`mfaStepUpRequired`, `isValidTotpCode`), endpoint d'audit MFA, actions d'audit.

**Hors périmètre (YAGNI)** : SMS/email OTP, codes de secours/recovery codes, MFA obligatoire, « se souvenir de cet appareil » (trusted devices), MFA pour l'enrôlement client (les clients n'ont pas de compte), gestion multi-facteurs (un seul TOTP).

## 1. Logique pure (testée, sans réseau)

`src/lib/auth/mfa.ts` :
- `mfaStepUpRequired(currentLevel, nextLevel)` → `boolean` : `currentLevel === 'aal1' && nextLevel === 'aal2'`.
- `isValidTotpCode(code)` → `boolean` : `/^\d{6}$/.test(code.trim())`.

Utilisées par le `proxy.ts` (enforcement) et les écrans (validation du champ code).

## 2. Réglages → section « Sécurité » (`SecuritySection`)

Nouveau composant client `src/app/dashboard/settings/SecuritySection.tsx`, rendu sous le formulaire existant de la page Réglages.

- **Au chargement** : `supabase.auth.mfa.listFactors()`.
  - Aucun facteur TOTP vérifié → état « non activée », bouton **Activer la double authentification**.
  - Facteur vérifié présent → état « 2FA activée ✅ », bouton **Désactiver**.
- **Activer** : `mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator' })` → affiche le **QR** (`data.totp.qr_code`) + le secret en clair (repli si pas de scan) → champ code → `mfa.challengeAndVerify({ factorId: data.id, code })`. Succès → POST `/api/auth/mfa-event { event: 'enrolled' }` (audit) → recharge l'état. Échec/abandon → `mfa.unenroll({ factorId })` pour ne pas laisser un facteur non vérifié orphelin.
- **Désactiver** : confirmation → `mfa.unenroll({ factorId })` → POST `/api/auth/mfa-event { event: 'disabled' }` → recharge. (Si Supabase renvoie une erreur AAL, message « Reconnectez-vous puis réessayez ».)
- Validation du champ code via `isValidTotpCode` avant l'appel.

La page Réglages (`page.tsx`) importe et rend `<SecuritySection />` dans une carte cohérente avec les sections existantes (même grammaire Tailwind, icône `ShieldCheck`).

## 3. Connexion — page d'étape MFA (`/login/mfa`)

La page de login existante **reste inchangée** (login serveur + redirection). L'étape MFA est gérée séparément :
- Nouveau `src/app/login/mfa/page.tsx` (client) : champ code à 6 chiffres → `mfa.listFactors()` pour le `factorId` du TOTP vérifié → `mfa.challengeAndVerify({ factorId, code })`. Succès → la session passe AAL2 → redirige selon le rôle (`merchants.role` : `/admin` sinon `/dashboard`), comme la page login. Échec → message « Code incorrect ».
- Lien « Annuler » → `supabase.auth.signOut()` puis retour `/login`.

## 4. Enforcement — `proxy.ts` (middleware)

Après `getUser()`, calcul de l'AAL :
```
const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
const needsStepUp = mfaStepUpRequired(aal?.currentLevel, aal?.nextLevel);
```
- `!user` & route protégée (`/dashboard`,`/scan`,`/admin`) → `/login` (existant).
- `user` & `needsStepUp` : seule `/login/mfa` (et pages publiques) est permise ; toute route protégée OU `/`,`/login`,`/signup` → redirige vers **`/login/mfa`**.
- `user` & **pas** de step-up : `/`,`/login`,`/login/mfa`,`/signup` → `/dashboard` (généralise la règle existante).

→ Un marchand connecté par mot de passe mais 2FA non validée ne peut atteindre **aucune** page protégée tant qu'il n'a pas saisi son code.

## 5. Audit — `/api/auth/mfa-event`

`POST /api/auth/mfa-event` `{ event: 'enrolled' | 'disabled' }` (`runtime nodejs`) :
- Auth marchand (`getSession` → 401). Valide `event` (sinon 400).
- `logAuditEvent({ action: event === 'enrolled' ? 'MFA_ENROLLED' : 'MFA_DISABLED', user_id, merchant_id, ... })`.
- Ajout de `'MFA_ENROLLED'` et `'MFA_DISABLED'` à `AuditAction` (`src/lib/auditLog.ts`).

## 6. Configuration Supabase

Le facteur TOTP du MFA Supabase est **activé par défaut** sur le projet. Je le **vérifie** (et l'active si besoin, avec consentement) côté projet `oqcelbbozpykwkasjtqy`. Aucune migration de schéma (Supabase stocke les facteurs MFA dans `auth.*`, géré par la plateforme).

## 7. Validation & sécurité

- L'enforcement vit dans le `proxy.ts` (serveur) : impossible d'atteindre une page protégée en AAL1 si la 2FA est active.
- `enroll`/`verify`/`unenroll` opèrent sur la **session du marchand connecté** (client navigateur) → un marchand ne touche que sa propre 2FA.
- L'endpoint d'audit exige une session ; aucune donnée d'un autre marchand.
- Optionnel : aucun impact sur les comptes qui n'activent pas la 2FA.

## 8. Tests (TDD)

Logique pure (`src/lib/auth/__tests__/mfa.test.ts`) :
- `mfaStepUpRequired` : `('aal1','aal2')→true` ; `('aal2','aal2')→false` ; `('aal1','aal1')→false` ; valeurs nulles/undefined → false.
- `isValidTotpCode` : `'123456'→true` ; `' 123456 '→true` (trim) ; `'12345'→false` ; `'abcdef'→false` ; `''→false`.

Reste (enroll/challenge/verify Supabase, UI, proxy) : vérifié par `npm run build` + **fumée sur le compte démo** (activer la 2FA avec une vraie appli d'authentification → se déconnecter → reconnexion demande le code → désactiver).

## Réutilisation / cohérence

Réutilise le MFA natif Supabase (zéro dépendance ajoutée), le client navigateur existant (`@/utils/supabase/client`), `logAuditEvent`, le `proxy.ts` existant (on étend sa logique), la grammaire UI des Réglages et du Login. La logique d'éligibilité devient deux fonctions pures testées, source unique de la règle « faut-il un code ? ». Aucune migration BDD.
