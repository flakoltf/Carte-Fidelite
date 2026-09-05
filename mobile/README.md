# HALO Comptoir — app mobile marchande

Application iPhone (puis Android) destinée au **commerçant**, pas au client
final : le client garde sa carte dans Apple/Google Wallet et n'installe jamais
rien. Ce dossier est un **projet Expo autonome** : son propre `package.json`,
son `tsconfig`, ses tests, sa CI. Il ne partage rien avec l'app Next.js de la
racine — seulement la même base Supabase et les mêmes routes `/api`.

Cette mission (M2) livre **le socle, pas le métier** : connexion, navigation,
design system, client API. Les écrans Comptoir / Clients / Messages sont des
écrans d'attente assumés, remplis aux missions M3 et M4.

## Démarrer

```bash
cd mobile
npm install
cp .env.example .env.local     # puis renseignez les deux valeurs publiques
npx expo start                 # QR code + menu du serveur de développement
```

Puis, au choix :

- **iPhone physique** : installez **Expo Go** depuis l'App Store, ouvrez
  l'appareil photo et scannez le QR code affiché par `npx expo start`. Le
  téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi (sinon,
  `npx expo start --tunnel`).
- **Simulateur iOS** : `npx expo start --ios` (Expo Go est installé
  automatiquement dans le simulateur).
- **Émulateur Android** : `npx expo start --android`.

Aucun build natif n'est nécessaire : le projet reste en **workflow managé** et
n'utilise que des modules embarqués dans Expo Go.

## Configuration

Tout passe par des variables `EXPO_PUBLIC_*` (les seules qu'Expo expose au
bundle), documentées dans [`.env.example`](.env.example) :

| Variable | Équivalent web | Rôle |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` | projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé **anon** publique |
| `EXPO_PUBLIC_API_BASE_URL` | — | base des appels `/api` (défaut : `https://app.halocard.ch`) |

**Jamais de clé service-role ici.** Tout ce qui est préfixé `EXPO_PUBLIC_` est
lisible dans le bundle par n'importe qui : `readConfig` refuse de démarrer si la
clé fournie ressemble à une clé service-role (JWT `role: service_role` ou
préfixe `sb_secret_`). `.env.local` est ignoré par git.

## Captures (simulateur iPhone 16, Expo Go)

| Connexion | Comptoir | Clients | Menu |
|---|---|---|---|
| ![Connexion](docs/captures/01-connexion.png) | ![Comptoir](docs/captures/02-comptoir.png) | ![Clients](docs/captures/03-clients.png) | ![Menu](docs/captures/04-menu.png) |

La pastille bleue en haut à droite est le bouton de menu développeur d'Expo Go,
pas un élément de l'app.

## Structure

```
mobile/
├── app/                       Routes (expo-router, routage par fichiers)
│   ├── _layout.tsx            Providers : safe areas, session, pile de navigation
│   ├── index.tsx              Aiguillage selon l'état de session
│   ├── connexion/
│   │   ├── index.tsx          Écran de connexion (e-mail + mot de passe)
│   │   └── code.tsx           Défi TOTP (comptes avec double authentification)
│   └── (tabs)/                Barre d'onglets, accessible session complète uniquement
│       ├── _layout.tsx        Les 4 onglets + garde de navigation
│       ├── comptoir.tsx       (M3) scan et crédit
│       ├── clients.tsx        (M4) clientèle
│       ├── messages.tsx       (M4) relances Wallet
│       └── menu.tsx           Commerce, déconnexion, renvoi vers l'ordinateur
├── src/
│   ├── components/            Design system : Button, Card, Field, Screen, HaloMark, TabIcon
│   ├── lib/
│   │   ├── api.ts             ⭐ client API central (Bearer sur chaque appel)
│   │   ├── config.ts          lecture et validation des variables publiques
│   │   ├── supabase.ts        client Supabase + rafraîchissement de session
│   │   ├── secureStorage.ts   session stockée dans le trousseau, en tranches
│   │   ├── authFlow.ts        règles d'auth pures (TOTP, messages, statuts)
│   │   └── auth/              port `AuthGateway`, adaptateur Supabase, `AuthProvider`
│   └── theme/                 jetons de marque HALO (couleurs, espacements, type)
└── assets/                    icônes de l'app (sources SVG dans `assets/source/`)
```

## Connexion

1. **Mot de passe** — `supabase.auth.signInWithPassword`, exactement les mêmes
   comptes que le tableau de bord web.
2. **Second facteur** — si le compte a la double authentification, le niveau
   d'assurance passe de `aal1` à `aal2` et l'app affiche l'écran du code à six
   chiffres (`supabase.auth.mfa.challengeAndVerify`). Même règle que
   `src/lib/auth/mfa.ts` côté web.
3. **Session** — persistée par `expo-secure-store` (trousseau iOS,
   EncryptedSharedPreferences Android), jamais dans un stockage en clair. Le
   trousseau Android plafonne une valeur à 2048 octets : `secureStorage.ts`
   découpe donc la session en tranches et la recolle à la lecture.
4. **Déconnexion** — depuis l'onglet Menu, avec confirmation.

L'écran ne connaît jamais Supabase : il parle au port `AuthGateway`
(`src/lib/auth/gateway.ts`), ce qui rend toute la logique testable sans réseau.

## Client API

`src/lib/api.ts` est le **seul** endroit qui appelle `fetch` vers
`app.halocard.ch`. Il attache `Authorization: Bearer <jeton de session>`,
sérialise les paramètres, traduit les erreurs en français et signale une session
expirée. Les écrans M3/M4 passeront tous par lui :

```ts
import { api } from "@/lib/api";

const clients = await api().get<Client[]>("/api/clients", { query: { q: "Dupont" } });
await api().post("/api/scan", { carte: cardId });
```

> ⚠️ **Prérequis côté serveur** : les routes `/api` de l'app Next lisent
> aujourd'hui la session dans un **cookie**. Elles doivent accepter l'en-tête
> `Authorization: Bearer` pour que l'app mobile puisse les appeler — c'est le
> sujet d'une PR distincte (jeton Bearer API mobile). Le socle est prêt, les
> écrans métier attendent ce feu vert.

## Design system

Jetons dans `src/theme/tokens.ts`, dérivés de `docs/brand-guidelines.md` :
Émeraude `#0D6B5E`, Glow `#1FB89A`, Onyx `#0E0F11`, Calcaire `#F3F0E9`,
Galet `#9B9DA0`. Typographie **système** (San Francisco / Roboto) : Canela et
Söhne sont sous licence et restent au web.

Règles tenues par les composants et vérifiées par les tests :

- cible tactile ≥ **44 pt** sur les boutons et les champs (`MIN_TOUCH_TARGET`) ;
- zones sûres respectées via `Screen` (encoche, barre d'accueil) ;
- clavier géré (`KeyboardAvoidingView`, la vue défile, le champ reste visible) ;
- intitulés, rôles et erreurs annoncés aux lecteurs d'écran ;
- copy en français suisse, vouvoiement, ton direct.

## Qualité

```bash
npm run lint        # eslint (config Expo)
npm run typecheck   # tsc --noEmit, TypeScript strict
npm test            # jest (preset jest-expo) — 70 tests, aucun appel réseau
```

Les trois commandes tournent aussi en CI sur toute modification de `mobile/`
(`.github/workflows/mobile-ci.yml`).

Les tests couvrent le socle : découpage et relecture de la session chiffrée,
validation de la configuration (dont le refus d'une clé service-role), règles
d'auth et messages, client API (jeton attaché, erreurs, 401), composants du
design system (cible tactile, accessibilité, états) et machine d'état de session
(mot de passe → TOTP → connecté → déconnecté), avec une passerelle en mémoire.
