# HALO Comptoir — dossier de publication App Store

> Préparé le 2026-09-10, sans compte Apple (les marqueurs `A_REMPLIR_` de
> `mobile/eas.json` sont normaux : ils se remplissent aux étapes 1 et 5 de la
> checklist). Ce document rassemble **tout ce qui se prépare avant** de créer le
> compte : checklist, fiche, questionnaire App Privacy, compte de démonstration,
> mode de distribution, captures. La mécanique détaillée des commandes EAS est
> dans [`docs/PUBLICATION-APP-STORE.md`](PUBLICATION-APP-STORE.md) — les deux
> documents sont cohérents, celui-ci renvoie à l'autre pour le pas-à-pas.
>
> Rappels : app **pour le commerçant** (`mobile/README.md`) — le client final
> n'installe rien, sa carte vit dans Apple Wallet. Bundle `ch.halocard.comptoir`,
> nom « HALO Comptoir », version 1.0.0 (`mobile/app.json`). Aucun secret ne se
> commit : ni mot de passe Apple, ni identifiants du compte de démonstration.

---

## 1. Checklist ordonnée de publication

| # | Étape | Qui | Durée typique | Pièges connus (Expo managé) |
|---|---|---|---|---|
| 1 | **Compte Apple Developer Program** (99 USD/an) sur <https://developer.apple.com/programs/enroll/>. Le compte qui a émis le certificat Pass Type ID des cartes Wallet convient : même équipe, rien à recréer. Sinon, s'inscrire en **individuel** (raison individuelle HALOCARD - Letaief, IDE CHE-242.720.495) : validation en 24–48 h ; l'inscription « organisation » exige un numéro D-U-N-S et peut prendre des semaines — inutile ici. | Fondateur (identité + paiement) | 30 min + 1–2 jours de validation | L'e-mail du compte devient `appleId` dans `eas.json` : prendre une adresse pérenne (pas une adresse jetable). Activer la double authentification Apple ID, exigée par Apple — c'est la 2FA du **compte développeur**, sans rapport avec celle des marchands. |
| 2 | **Compte Expo + projet EAS** : `eas login`, puis `cd mobile && eas init`. | Fondateur (auth) puis agent | 10 min | `eas init` écrit `extra.eas.projectId` dans `mobile/app.json` : **committer cette modification**, elle appartient au dépôt (voir PUBLICATION-APP-STORE.md §2.3). |
| 3 | **Build preview sur iPhone réel** : `eas device:create` puis `eas build --profile preview --platform ios`. | Fondateur (Apple ID + iPhone) | 10–30 min de build | Premier moment où les vraies chaînes de permission s'appliquent : **Expo Go utilisait les siennes**, donc rien du parcours caméra n'est validé avant ce build. Le simulateur n'a pas de caméra. Checklist appareil réel : PUBLICATION-APP-STORE.md §7. |
| 4 | **Fiche App Store Connect** : Mes apps → + → Nouvelle app, iOS, « HALO Comptoir », langue principale **français**, bundle `ch.halocard.comptoir`, SKU libre (`halocard-comptoir-001`). Relever l'**Apple ID de l'app** (nombre à 10 chiffres). | Fondateur | 15 min | Si le bundle n'apparaît pas dans la liste, EAS ne l'a pas encore enregistré : relancer un build ou créer l'identifiant sur le portail développeur. **Si la distribution unlisted est retenue (§5), déposer la demande dès la fiche créée** — avant la soumission en review. |
| 5 | **Compléter `mobile/eas.json`** : `appleId` (e-mail du compte), `ascAppId` (nombre de l'étape 4), `appleTeamId` (10 caractères, Membership sur developer.apple.com). Ce sont des identifiants publics, committables ; un mot de passe, jamais. | Agent (valeurs fournies par le fondateur) | 5 min | Ne pas confondre `ascAppId` (numérique) et le bundle ID (`ch.halocard.comptoir`). |
| 6 | **Build production + envoi** : `eas build --profile production --platform ios` puis `eas submit --platform ios --latest`. | Fondateur (mot de passe pour application, créé sur account.apple.com) | 30–60 min | Le profil `production` a `autoIncrement` + `appVersionSource: "remote"` : ne plus jamais toucher `buildNumber` à la main. À l'envoi, Apple pose la question du **chiffrement à l'export** : l'app n'utilise que HTTPS/TLS standard → réponse « chiffrement standard / exempté » (aucun algorithme propriétaire dans `mobile/`). |
| 7 | **TestFlight interne** : onglet TestFlight → Informations de test → testeurs internes (le fondateur + premiers commerçants pilotes, jusqu'à 100). Aucune revue Apple pour les testeurs internes ; un build y vit 90 jours. | Fondateur | Traitement Apple 10 min–1 h, puis invitations immédiates | Le trousseau d'un vrai build n'est pas celui d'Expo Go : revalider la persistance de session après fermeture de l'app. |
| 8 | **Fiche complète** : textes du §2, captures du §6, questionnaire App Privacy du §3, compte de démonstration du §4 (+ QR de test en pièce jointe), notes pour la review (modèle : PUBLICATION-APP-STORE.md §6.3). | Agent (textes) + fondateur (saisie ASC) | 1–2 h | Sans compte de démonstration, rejet **automatique** : l'inscription publique est désactivée (`/signup` → `/login`). |
| 9 | **Soumission en review** | Fondateur | Verdict sous 24–48 h en général | Premier envoi d'une app de ce profil (connexion obligatoire, B2B) : s'attendre à une question du relecteur plutôt qu'à un rejet sec si les notes sont claires. Répondre dans Resolution Center, ne pas re-soumettre à l'aveugle. |

---

## 2. Fiche App Store (français suisse)

- **Nom** (30 car. max) : `HALO Comptoir`
- **Sous-titre** (30 car. max) : `Fidélité sans appli client` (26 car.)
- **Catégorie** : Économie et entreprise (Business) ; secondaire : Productivité.
- **URL d'assistance** : `https://halocard.ch/contact` (page réelle :
  `src/app/(marketing)/contact/page.tsx`)
- **URL de confidentialité** : `https://halocard.ch/confidentialite` (page
  réelle : `src/app/(marketing)/confidentialite/page.tsx` ; la section 12 de
  `src/content/legal/confidentialite.md` couvre explicitement l'application
  mobile « HALO Comptoir »)
- **Copyright** : `© 2026 HALOCARD - Letaief, Genève` (source :
  `src/content/legal/company.ts`)
- **Mots-clés** (100 car. max, séparés par des virgules, sans espaces — ne pas
  répéter « HALO » ni « comptoir », déjà dans le nom) :

  ```
  fidélité,carte,tampon,wallet,commerçant,scan,QR,client,caisse,boutique,genève,commerce
  ```

  (95 caractères)

- **Description** :

  ```
  HALO Comptoir est l'outil de comptoir des commerçants abonnés à HaloCard,
  le service genevois de cartes de fidélité numériques.

  Vos clients n'installent rien : leur carte vit dans Apple Wallet ou Google
  Wallet. Vous, vous ouvrez HALO Comptoir, vous scannez, c'est crédité.

  COMPTOIR
  Scannez le QR code de la carte avec la caméra. Le tampon ou les points
  sont crédités immédiatement, la carte du client se met à jour dans son
  Wallet, et l'écran vous confirme le résultat en toutes lettres — récompense
  atteinte comprise. Une erreur de scan ? Annulez le dernier crédit d'un tap.

  CLIENTS
  Votre clientèle, classée par segments : nouveaux, réguliers, VIP, en train
  de partir, inactifs. Recherchez un nom, ouvrez sa fiche, voyez ses visites
  et sa progression.

  MESSAGES
  Envoyez un message directement sur les cartes Wallet d'un segment : une
  offre pour faire revenir les inactifs, un merci pour vos VIP. Sans
  newsletter, sans application à faire installer.

  RÉSERVÉ AUX COMMERÇANTS
  Cette application est destinée aux commerces abonnés à HaloCard. Les
  comptes sont créés par notre équipe lors de la mise en service : il n'y a
  pas d'inscription dans l'application. Pas encore client ?
  Rendez-vous sur halocard.ch.
  ```

- **Nouveautés (version 1.0.0)** : `Première version : scan au comptoir,
  base clients par segments, messages Wallet.`
- **Notes pour la review** : reprendre le texte prêt à coller de
  PUBLICATION-APP-STORE.md §6.3 (connexion requise, pas d'inscription publique,
  aucun achat intégré, QR de test en pièce jointe).

---

## 3. Questionnaire App Privacy — pré-rempli d'après le code

Formulaire : App Store Connect → fiche de l'app → **Confidentialité de l'app**.
Chaque réponse ci-dessous est justifiée par le code réel de `mobile/`. Les
dépendances complètes sont dans `mobile/package.json` : Expo, React Native,
`@supabase/supabase-js`, `expo-camera`, `expo-haptics`, `expo-secure-store`,
`expo-router`, `react-native-safe-area-context`, `react-native-screens` —
**aucun SDK publicitaire, d'analytique ou de crash reporting** (Sentry n'existe
que côté web, pas dans `mobile/`).

**« Collectez-vous des données ? » → Oui.**

### Données collectées (liées à l'identité, jamais pour du suivi publicitaire)

| Catégorie Apple | Détail | Finalité | Justification (fichier) |
|---|---|---|---|
| Coordonnées → **Adresse e-mail** | E-mail professionnel du commerçant, saisi à la connexion | Fonctionnement de l'app (authentification) | `mobile/app/connexion/index.tsx` → `supabase.auth.signInWithPassword` via le port `mobile/src/lib/auth/` ; session persistée par `mobile/src/lib/supabase.ts` |
| Identifiants → **ID utilisateur** | Identifiant de compte et jeton de session, attaché en `Authorization: Bearer` à chaque appel ; identifiant de carte lu dans le QR du client | Fonctionnement de l'app | `mobile/src/lib/api.ts` (client unique vers `app.halocard.ch`, en-tête Bearer l. 97) ; `mobile/src/features/comptoir/scanApi.ts` (`POST /api/scan { cardId }`) |
| Contenu utilisateur → **Autre contenu** | Noms des clients du commerce et leurs compteurs de fidélité (visites, tampons, dernier passage), **consultés** depuis le serveur ; texte des messages Wallet rédigés par le commerçant | Fonctionnement de l'app | `mobile/src/features/clients/contracts.ts` (`SegmentMember` : `customerId`, `name`, `lastScan`, `visits`, `stamps`) ; `mobile/src/features/messages/sendMessage.ts` (`POST /api/notifications/send`) |

Point de jugement assumé (hérité de PUBLICATION-APP-STORE.md §5) : les données
clients appartiennent au *client du commerçant*, pas à l'utilisateur de l'app.
Apple ne fait pas cette distinction : on déclare, par prudence, plutôt trop que
pas assez. L'app ne fait qu'**afficher** ces données (le serveur classe et
calcule — en-tête de `contracts.ts`) ; rien n'est stocké sur l'appareil hors la
session chiffrée.

### Données à NE PAS déclarer

| Catégorie | Justification vérifiable |
|---|---|
| Localisation, contacts, photos, fichiers | Seules permissions déclarées dans `mobile/app.json` : caméra (micro et Face ID explicitement désactivés, `plugins` l. 34–50) |
| Photos / vidéos / audio | La caméra ne capture **aucune image** : seul le contenu du QR décodé part au serveur (`scanApi.ts`) ; texte de permission : « Aucune photo n'est prise ni enregistrée » |
| Données d'utilisation, diagnostics, plantages | Aucun SDK d'analytique ni de crash reporting dans `mobile/package.json` |
| Historique de recherche | La recherche Clients filtre une liste **déjà chargée**, en local (`mobile/src/features/clients/ClientsScreen.tsx`) ; rien n'est transmis ni conservé |
| Achats, données financières, santé | Sans objet — aucun achat intégré, facturation hors application |

### Réponses transversales

- **Suivi publicitaire (ATT) : non.** Aucun identifiant publicitaire, aucun
  partage avec des courtiers en données.
- **Données vendues ou partagées avec des tiers : non.** Un seul destinataire :
  les serveurs HaloCard (`app.halocard.ch`, `DEFAULT_API_BASE_URL` dans
  `mobile/src/lib/config.ts`) et Supabase, sous-traitant d'hébergement déjà
  listé dans la politique de confidentialité.
- **Stockage sur l'appareil** : uniquement la session, dans le trousseau iOS
  (`mobile/src/lib/secureStorage.ts`, via `expo-secure-store` — jamais de
  stockage en clair, cf. `mobile/src/lib/supabase.ts`).
- **URL de la politique** : `https://halocard.ch/confidentialite`, section 12
  « Application mobile HALO Comptoir ».

---

## 4. Compte de démonstration pour App Review

**Obligatoire** : l'app exige une connexion et l'inscription publique est
désactivée (`/signup` redirige vers `/login`). Sans identifiants fournis dans
la fiche, rejet automatique (guideline 2.1). Procédure de création via le mode
concierge existant — **à exécuter le moment venu, pas maintenant** :

1. **Créer le marchand démo** : `app.halocard.ch/admin/merchants/new`
   (`src/app/(app)/admin/merchants/new/NewMerchantForm.tsx`). Champs : nom de
   boutique **fictif** (ex. « Café Démo HALO »), e-mail dédié de type
   `demo-review@halocard.ch` (boîte contrôlée par le fondateur), couleur de
   marque. Le formulaire (`POST /api/admin/merchants`) renvoie un **mot de
   passe temporaire** — le noter hors dépôt, il ne s'écrit ni ici ni dans un
   commit. Ne PAS réutiliser un vrai commerçant : le relecteur créditera des
   tampons pour de bon. Ne pas réutiliser non plus `demo@walletcard.app`
   (`docs/COMPTES-DEMO.md`) : ancien domaine, données partagées avec les démos
   commerciales.
2. **Vérifier l'absence de 2FA** : ne pas enrôler ce compte en double
   authentification. L'app exige le code TOTP dès que le compte est en `aal2`
   (`mobile/app/connexion/code.tsx`, même règle que `src/lib/auth/mfa.ts`) et
   le relecteur d'Apple ne recevra jamais ce code → rejet certain.
3. **Configurer la carte** : depuis `admin/merchants`, bouton « Gérer comme »
   (`ManageAsButton.tsx` → `POST /api/admin/impersonate/start`, impersonation
   auditée) pour ouvrir le dashboard du marchand démo et régler une mécanique
   simple au Studio (tampons, ex. 10 tampons → 1 café offert).
4. **Semer des données clients FICTIVES** : via « Ma carte » (QR d'enrôlement
   du dashboard) ou `halocard.ch/c/<slug-du-demo>`, créer 5 à 10 cartes avec
   des noms inventés (Anna Exemple, Bruno Témoin, …) et quelques scans, pour
   que les onglets Clients et Messages ne soient pas vides. Aucune donnée
   réelle : la review est un environnement hors de votre contrôle.
5. **Produire le QR de test** : le QR d'une carte est la valeur **signée**
   portée par le pass Wallet (l'identifiant seul est rejeté comme forgé).
   Ouvrir le pass d'une carte démo, capturer son code-barres, joindre l'image
   aux informations de review avec une phrase d'explication
   (PUBLICATION-APP-STORE.md §6.2).
6. **Saisir dans App Store Connect** : Informations pour la revue → cocher
   « Connexion requise » → identifiant + mot de passe du marchand démo,
   directement dans ces champs, jamais dans le dépôt.

---

## 5. Distribution : publique ou « unlisted » ?

**Recommandation : demander la distribution unlisted pour la v1.**

| Critère | App Store public | Unlisted app distribution |
|---|---|---|
| Découvrabilité | Recherche, classements, fiche indexée | Fiche accessible **uniquement par lien direct** ; invisible en recherche et en classements |
| Adéquation au modèle | Faible : concierge, comptes créés à la main, prospection terrain à Genève — personne ne « découvre » l'app, on l'installe chez le commerçant lors de la mise en service | Forte : le lien s'envoie dans l'e-mail de bienvenue du marchand, ou se scanne pendant la visite terrain |
| Risque en review | Réel : une app à connexion obligatoire, sans inscription ni contenu public, à audience restreinte, se fait régulièrement rediriger par Apple vers… la distribution unlisted (guideline 3.2, apps « for a limited audience ») | Écarté par construction — c'est précisément le dispositif prévu pour ce cas |
| Review Apple | Complète, à chaque version | **Identique** : mêmes guidelines, mêmes captures, même App Privacy, même compte de démonstration — tout ce dossier reste nécessaire |
| Coût / infra | Rien de plus | Rien de plus (pas d'Apple Business Manager, pas de MDM — à ne pas confondre avec la distribution « custom apps » B2B) |

**Procédure de demande** : formulaire
<https://developer.apple.com/support/unlisted-app-distribution/> (demande de
lien unlisted), à déposer **une fois la fiche créée et l'app prête pour la
review, avant la première soumission publique**. Décrire l'audience :
application interne aux commerces clients de HaloCard, comptes créés par
l'éditeur, pas d'inscription publique. Réponse d'Apple sous quelques jours ;
une fois accordé, l'app garde son URL App Store complète, installable
normalement, simplement non référencée.

**Réversibilité** : le statut unlisted est accordé pour la fiche et perdure ;
passer en distribution publique ensuite se demande à Apple (App Review /
support) — c'est un échange, pas un interrupteur, mais c'est le sens de
migration facile : commencer unlisted n'hypothèque rien, l'app, la fiche, les
notes et l'historique TestFlight restent les mêmes. Déclencheurs pour passer
public : ouverture de l'inscription en libre-service, ou expansion au-delà du
cercle prospecté où la découvrabilité devient un canal d'acquisition.

À noter : TestFlight interne (checklist #7) couvre déjà les tout premiers
commerçants sans aucune review ; unlisted prend le relais quand il faut une
installation stable, sans expiration de 90 jours ni app TestFlight à faire
installer.

---

## 6. Captures d'écran

### Pourquoi celles du dépôt sont irrecevables

Les images de `mobile/docs/captures/` (`01-connexion.png`, `05-clients.png`,
`m5-apres-comptoir.png`, …) documentent le développement, pas la fiche :

1. **Pastille Expo Go** : le bouton flottant du menu développeur d'Expo Go est
   visible en haut à droite (signalé dans `mobile/README.md`) — un élément
   d'interface qui n'existe pas dans le build de production ; Apple rejette les
   captures qui ne reflètent pas l'app soumise (guideline 2.3.3), et une UI de
   debug à l'écran en est le cas d'école.
2. **Chaînes d'Expo Go** : ces captures viennent d'Expo Go, dont les écrans
   système (permission caméra notamment) ne sont pas ceux du vrai build.
3. **Tailles** : prises sur simulateur iPhone 16 sans contrainte de format,
   elles ne correspondent pas aux résolutions exactes exigées par App Store
   Connect.

### Produire les bonnes captures

1. Installer le **build TestFlight** (ou `preview`) sur un iPhone — plus de
   pastille, vraies chaînes de permission. Le simulateur reste utilisable en
   dépannage (`xcrun simctl io booted screenshot`), mais l'onglet Comptoir y
   affiche un écran sans caméra : la capture phare du scan exige un appareil
   réel.
2. Capturer en **portrait** (l'app est verrouillée portrait dans `app.json`)
   les 4 à 6 écrans dans l'ordre de l'argumentaire : Comptoir en scan,
   résultat de crédit plein écran, Clients (segments remplis de données
   fictives du marchand démo §4), fiche client, Messages, Menu.
3. **Tailles exigées** (App Store Connect, 2026) : un seul jeu iPhone 6,9″
   obligatoire — **1320 × 2868 px** (portrait, iPhone 16 Pro Max ; 1290 × 2796
   accepté). Apple redimensionne pour les écrans plus petits ; un jeu 6,5″
   (1242 × 2688 ou 1284 × 2778) peut être fourni en plus pour les anciens
   appareils. PNG ou JPEG, sans transparence, sans coins arrondis ajoutés.
   De 1 à 10 captures ; pas de jeu iPad (`supportsTablet: false`).
4. **Contenu** : uniquement des données fictives (§4), barre de statut propre
   (heure pleine, batterie pleine — sur simulateur :
   `xcrun simctl status_bar booted override --time "9:41"`), pas de
   notification qui traîne. Les captures brutes suffisent ; un habillage
   (fond + accroche courte en français) est permis tant que l'écran réel de
   l'app reste dominant.

---

## Ce qui reste hors de portée sans compte Apple

Créer le compte (checklist #1), `eas init` (#2), tout build (#3, #6), la fiche
App Store Connect (#4), les valeurs `submit` de `eas.json` (#5), la demande
unlisted (§5) et les captures définitives (§6). Tout le reste — textes,
questionnaire, procédure du compte démo, choix de distribution — est prêt dans
ce document.
