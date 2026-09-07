# Publier HALO Comptoir — TestFlight, puis App Store

Ce document s'adresse à quelqu'un qui n'a **jamais** publié d'application. Il se
suit dans l'ordre, depuis le Mac. Chaque commande est expliquée : ce qu'elle
fait, ce qu'elle demande, et ce qu'elle laisse derrière elle.

> **Ce que ce dépôt fait, et ce qu'il ne fera jamais.** Le dépôt prépare la
> *configuration* : permissions, profils de build, textes. Il ne touche
> **jamais** aux certificats, aux clés de signature ni au compte Apple. Ces
> éléments-là, c'est vous qui les créez, en vous authentifiant. Aucun mot de
> passe, aucune clé, aucun certificat ne doit être écrit dans ce dépôt.

---

## 0. Ce qui est déjà prêt, et ce qu'il vous faut

**Déjà dans le dépôt** (rien à refaire) :

| Élément | Valeur |
|---|---|
| Nom affiché | HALO Comptoir |
| Identifiant iOS (bundle) | `ch.halocard.comptoir` |
| Identifiant Android (package) | `ch.halocard.comptoir` |
| Version | `1.0.0` |
| Numéro de build iOS initial | `1` |
| Icône, écran de démarrage | `mobile/assets/` |
| Permission caméra (iOS + Android) | déclarée, texte français — voir §1 |
| Profils de build | `mobile/eas.json` — voir §3 |

**Ce qu'il vous faut de votre côté :**

1. **Un Mac** avec Node installé (le même que pour développer).
2. **Un compte Apple Developer Program payant.** Vous l'avez déjà : c'est lui
   qui vous a délivré le certificat Pass Type ID utilisé pour signer les cartes
   Apple Wallet. C'est le même compte, la même équipe.
3. **Un compte Expo** (gratuit) pour lancer les builds sur leurs serveurs :
   <https://expo.dev/signup>.
4. **Un iPhone réel.** Non négociable : le simulateur n'a pas de caméra, donc le
   scan n'a jamais pu être testé (voir §7).

---

## 1. La permission caméra — pourquoi c'était bloquant

Jusqu'à cette livraison, `expo-camera` était installé mais **non déclaré** dans
la configuration. Conséquence : la chaîne `NSCameraUsageDescription` n'était pas
écrite dans l'`Info.plist` du build. Sur un vrai build, iOS **termine
l'application** au premier accès caméra quand cette chaîne manque, et App Review
rejette au titre de la règle 5.1.1.

Rien ne se voyait pendant le développement parce qu'**Expo Go utilise ses
propres chaînes de permission**, pas les vôtres.

C'est corrigé. Vérification, à refaire quand vous voulez :

```bash
cd mobile
npx expo config --type introspect | grep NSCameraUsageDescription
```

Sortie attendue :

```
NSCameraUsageDescription: "La caméra sert uniquement à lire le QR code de la
carte de fidélité de votre client. Aucune photo n'est prise ni enregistrée."
```

Deux permissions inutiles ont aussi été **retirées** au passage :

- `NSMicrophoneUsageDescription` — `expo-camera` l'ajoute par défaut (pour la
  vidéo). L'application n'enregistre jamais de son : demander le micro sans
  l'utiliser attire les questions d'App Review.
- `NSFaceIDUsageDescription` — ajoutée par défaut par `expo-secure-store`, en
  anglais, alors que l'application ne verrouille rien par biométrie.

Côté Android, la seule permission déclarée est `android.permission.CAMERA` :
`RECORD_AUDIO` a été explicitement désactivée.

> **Note technique.** `expo-haptics` ne se déclare pas : ce paquet ne fournit
> aucun plugin de configuration et n'a besoin d'aucune permission. L'ajouter au
> tableau `plugins` casse la résolution de configuration.

---

## 2. La suite de commandes, dans l'ordre

Toutes les commandes se lancent **depuis `mobile/`**.

### 2.1 Installer l'outil EAS

```bash
npm install --global eas-cli
```

*Ce que ça fait* : installe le client en ligne de commande d'Expo Application
Services, qui construit et envoie les applications. À faire une seule fois.

### 2.2 Se connecter à Expo

```bash
eas login
eas whoami        # vérifie qui est connecté
```

*Ce qu'on vous demande* : l'e-mail et le mot de passe de votre compte Expo.
Rien à voir avec Apple à ce stade.

### 2.3 Créer le projet EAS

```bash
cd mobile
eas init
```

*Ce que ça fait* : crée le projet côté Expo et **écrit un identifiant dans
`mobile/app.json`**, sous `extra.eas.projectId`. C'est normal et attendu :
**committez cette modification**, elle appartient au dépôt.

*Ce qu'on vous demande* : de confirmer le nom du projet (`halocard-mobile`).

> `eas build:configure` n'est pas nécessaire : `mobile/eas.json` existe déjà.

### 2.4 Premier build interne (recommandé avant tout le reste)

```bash
eas device:create                                  # enregistre votre iPhone
eas build --profile preview --platform ios
```

*Ce que ça fait* : `device:create` affiche un QR à scanner avec l'iPhone pour
enregistrer son identifiant matériel auprès d'Apple — nécessaire pour installer
un build interne. Le build, lui, est compilé sur les serveurs d'Expo (comptez
dix à vingt minutes) et vous recevez un lien d'installation.

*Ce qu'on vous demande, la première fois* : de vous connecter avec votre
**Apple ID** (avec le code à deux facteurs), puis d'autoriser EAS à **créer les
certificats et profils de provisionnement** à votre place. Répondez oui : c'est
la manière normale de faire, et les clés restent dans votre compte Apple et chez
Expo, jamais dans ce dépôt.

*Pourquoi commencer par là* : ce build tourne sur votre iPhone **avec vos vraies
chaînes de permission**, donc c'est le premier moment où le scan caméra peut
être testé pour de vrai (§7).

### 2.5 Build de production

```bash
eas build --profile production --platform ios
```

*Différence avec le précédent* : distribution `store` (paquet destiné à l'App
Store, non installable directement) et **incrémentation automatique du numéro de
build**. Le compteur est tenu par EAS (`appVersionSource: "remote"` dans
`eas.json`) : vous n'avez plus jamais à toucher `buildNumber` à la main, et deux
builds ne peuvent pas porter le même numéro — ce qu'Apple refuse.

Pour fixer explicitement le point de départ du compteur :

```bash
eas build:version:set --platform ios
```

### 2.6 Créer la fiche dans App Store Connect

Avant d'envoyer quoi que ce soit, il faut une fiche d'application :

1. <https://appstoreconnect.apple.com> → **Mes apps** → **+** → **Nouvelle app**.
2. Plateforme : iOS. Nom : *HALO Comptoir*. Langue principale : français.
3. **Bundle ID** : `ch.halocard.comptoir` (il doit apparaître dans la liste ; si
   ce n'est pas le cas, c'est qu'EAS ne l'a pas encore enregistré — relancez un
   build, ou créez l'identifiant depuis le portail développeur).
4. SKU : une référence libre, par exemple `halocard-comptoir-001`.

Notez l'**Apple ID de l'app** (un nombre à dix chiffres) affiché sur la fiche :
c'est le `ascAppId` de l'étape suivante.

### 2.7 Compléter `eas.json`, puis envoyer

Ouvrez `mobile/eas.json` et remplacez les trois marqueurs :

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "A_REMPLIR_AVANT_SUBMIT_email_du_compte_apple",
      "ascAppId": "A_REMPLIR_APRES_CREATION_DE_LA_FICHE_APP_STORE_CONNECT",
      "appleTeamId": "A_REMPLIR_identifiant_equipe_apple"
    }
  }
}
```

- `appleId` : l'e-mail de votre compte Apple Developer.
- `ascAppId` : le nombre à dix chiffres relevé à l'étape 2.6.
- `appleTeamId` : votre identifiant d'équipe (dix caractères), visible sur
  <https://developer.apple.com/account> sous *Membership*.

Ce ne sont **pas des secrets** — ce sont des identifiants publics de compte. Ils
peuvent être committés. Un mot de passe, jamais.

```bash
eas submit --platform ios --latest
```

*Ce que ça fait* : envoie le dernier build de production à App Store Connect.
*Ce qu'on vous demande* : un **mot de passe pour application** (« app-specific
password »), à créer sur <https://account.apple.com> → *Connexion et sécurité*.
Il se saisit dans le terminal, il ne se stocke pas dans le dépôt.

Après quelques minutes de traitement par Apple, le build apparaît dans l'onglet
**TestFlight** de votre fiche.

---

## 3. Les trois profils de build

`mobile/eas.json` en définit trois. À quoi sert lequel :

| Profil | Distribution | Pour quoi faire |
|---|---|---|
| `development` | interne | Build de développement avec le client de dev Expo. **Nécessite `npx expo install expo-dev-client`**, qui n'est pas installé aujourd'hui : le développement quotidien passe par Expo Go, ce profil est là pour plus tard. |
| `preview` | interne | Le build à installer sur votre iPhone et sur ceux de vos premiers commerçants, sans passer par Apple. **C'est celui à utiliser en premier.** |
| `production` | store | Le seul qui part chez Apple. Numéro de build auto-incrémenté. |

---

## 4. TestFlight d'abord, App Store ensuite

**TestFlight** est le service de test d'Apple : vous invitez des personnes par
e-mail, elles installent l'application depuis l'app TestFlight, et vous
récupérez leurs retours. Un build y reste disponible 90 jours.

Faites TestFlight d'abord, pour trois raisons concrètes :

1. **La revue y est plus légère.** Les tests internes (jusqu'à 100 personnes de
   votre équipe) ne passent aucune revue. Les tests externes passent une revue,
   mais plus rapide et moins exigeante que celle de l'App Store.
2. **C'est déjà tout ce dont votre modèle a besoin.** Vos comptes sont créés à la
   main, commerçant par commerçant. Vous connaissez chacun de vos utilisateurs :
   les inviter par e-mail sur TestFlight suffit à les équiper.
3. **Chaque livraison publique coûte un cycle de revue.** Tant que l'application
   bouge vite, la revue App Store est un péage à chaque version.

Passez à l'App Store public le jour où l'une de ces deux choses arrive : des
commerçants hors de votre cercle doivent s'installer l'application seuls, ou
l'inscription en libre-service s'ouvre.

**Chemin TestFlight, une fois le build envoyé :** App Store Connect →
TestFlight → renseigner *Informations de test* (ce qu'il faut essayer) →
**Testeurs internes** : ajouter les personnes → elles reçoivent une invitation.

---

## 5. Le questionnaire « App Privacy »

Apple demande de déclarer, type de donnée par type de donnée, ce que
l'application collecte. C'est un formulaire dans App Store Connect (fiche de
l'app → **Confidentialité de l'app**). Voici les réponses, établies d'après le
code réel de `mobile/`.

**Première question : « Collectez-vous des données ? » → Oui** (l'application
transmet l'e-mail de connexion à vos serveurs).

### Les données à déclarer

| Catégorie Apple | Déclarer ? | Détail | Finalité | Liée à l'identité | Suivi publicitaire |
|---|---|---|---|---|---|
| **Coordonnées → Adresse e-mail** | **Oui** | L'e-mail professionnel saisi à la connexion | Fonctionnement de l'app | Oui | **Non** |
| **Identifiants → ID utilisateur** | **Oui** | L'identifiant de compte et le jeton de session ; l'identifiant de carte lu dans le QR d'un client | Fonctionnement de l'app | Oui | **Non** |

### Les données à NE PAS déclarer, et pourquoi

| Catégorie | Réponse | Justification vérifiable dans le code |
|---|---|---|
| Localisation | Non | Aucune permission de localisation, aucun module de géolocalisation |
| Contacts, Photos, Fichiers | Non | Aucune permission demandée |
| Données de santé, financières | Non | Sans objet |
| Historique de navigation ou de recherche | Non | Sans objet |
| Contenu utilisateur (photos, audio) | Non | **La caméra ne capture aucune image** : seul le contenu du code lu est transmis |
| Données d'utilisation | Non | Aucun outil de mesure d'audience |
| Diagnostics, données de plantage | Non | Aucun SDK de rapport de plantage (pas de Sentry côté mobile) |
| Achats | Non | Aucun achat dans l'application |

### Les trois réponses transversales

- **Suivi publicitaire (App Tracking Transparency) : non.** Aucun identifiant
  publicitaire, aucun SDK de publicité, aucun partage avec un courtier. Les
  dépendances de l'application sont : Expo, React Native, `@supabase/supabase-js`,
  `expo-camera`, `expo-haptics`, `expo-secure-store`, `expo-router` — aucune
  n'est un traceur.
- **Données vendues à des tiers : non.**
- **URL de la politique de confidentialité :** `https://halocard.ch/confidentialite`
  — elle contient depuis cette livraison une section **« Application mobile HALO
  Comptoir »** qui décrit exactement ce tableau.

> **Le seul jugement à assumer.** L'identifiant de carte lu dans le QR concerne
> le *client du commerçant*, pas l'utilisateur de l'application. Apple ne prévoit
> pas cette nuance : par prudence, il est déclaré sous « Identifiants ». Mieux
> vaut déclarer un peu plus que se voir reprocher une déclaration incomplète.

---

## 6. Les notes pour App Review

L'application exige une connexion et **ne permet pas de créer un compte** : les
comptes sont créés par l'éditeur, commerçant par commerçant. Sans identifiants
de démonstration, le rejet est **automatique**.

### 6.1 Le compte de démonstration

Dans App Store Connect → fiche de l'app → **Informations pour la revue de
l'app** :

- Cochez **« Connexion requise »**.
- Renseignez un identifiant et un mot de passe **directement dans ces champs**.

> **Trois règles.**
> 1. **N'écrivez jamais ce mot de passe dans ce dépôt**, ni dans un commit, ni
>    dans un fichier de configuration.
> 2. Utilisez un **commerçant de démonstration dédié**, pas un vrai client : la
>    revue va scanner des cartes et créditer des tampons pour de bon.
> 3. **Vérifiez que ce compte n'a PAS la double authentification activée.** Le
>    relecteur d'Apple ne pourra pas recevoir votre code TOTP : avec la 2FA, il
>    ne peut pas entrer, et c'est un rejet certain.

### 6.2 Le QR de test — indispensable

Le cœur de l'application est le scan. Le relecteur doit donc avoir **quelque
chose à scanner**, et il n'aura pas de carte de fidélité sous la main.

Le champ *Informations pour la revue* accepte une **pièce jointe** : joignez-y
l'image d'un QR de carte de démonstration, imprimable, avec une phrase
d'explication.

Comment obtenir cette image : le QR d'une carte est la valeur **signée** que
porte le pass Wallet du client (l'identifiant seul ne suffit pas, il est rejeté
comme « QR invalide ou forgé »). Le chemin le plus simple est donc de créer une
carte sur le commerçant de démonstration, d'ouvrir son pass Wallet et de
photographier ou capturer son code-barres, puis de joindre cette image.

> À vérifier au moment de le faire : c'est le seul point de cette procédure qui
> n'a pas encore été exécuté de bout en bout.

### 6.3 Le texte à coller

À adapter, puis à coller dans **Notes** :

```
HALO Comptoir est l'outil de comptoir des commerçants abonnés au service
HaloCard (cartes de fidélité numériques dans Apple Wallet et Google Wallet).

L'application s'adresse aux COMMERÇANTS, pas à leurs clients. Les clients
finaux n'installent aucune application : leur carte vit dans Apple Wallet.

Les comptes sont créés par l'éditeur pour chaque commerçant sous contrat ;
il n'existe pas d'inscription publique. Un compte de démonstration est
fourni ci-dessus.

Pour tester la fonction principale (le scan) :
1. Connectez-vous avec le compte de démonstration.
2. Ouvrez l'onglet « Comptoir » et autorisez l'accès à la caméra.
3. Scannez le QR code joint à cette demande (pièce jointe, imprimable ou
   affiché sur un second écran).
4. L'écran confirme le crédit (« +1 tampon », progression). Un bandeau
   « Annuler ce tampon » permet de revenir en arrière pendant 5 minutes.

Aucun achat n'est possible dans l'application : l'abonnement des commerçants
est facturé hors application, sur facture, et l'application ne contient ni
tarif, ni bouton d'achat, ni lien de souscription.

L'application ne collecte aucune donnée à des fins publicitaires et ne
contient aucun traceur.
```

---

## 7. À vérifier sur un appareil réel — avant toute soumission

Le simulateur iOS n'a **pas de caméra** : le parcours de scan n'a jamais été
exécuté contre un vrai QR code. C'est écrit dans la PR de la mission M3, et ça
reste vrai aujourd'hui. Cette liste se fait avec un build `preview` installé sur
un iPhone (§2.4).

| À vérifier | Pourquoi c'est ici |
|---|---|
| **Scanner un vrai QR de carte** et voir le crédit | Jamais testé. C'est la fonction principale. |
| **Le texte de la demande de permission caméra** | C'est le premier build où vos chaînes s'appliquent (Expo Go utilisait les siennes). |
| **Refuser la permission**, puis la rétablir par les réglages | Le bouton « Ouvrir les réglages » n'a jamais tourné hors Expo Go. |
| **La lampe torche** | Le simulateur n'en a pas. |
| **Le retour haptique** | Ne se ressent que sur un appareil. |
| **La session survit à la fermeture de l'app** | Le trousseau d'un vrai build n'est pas celui d'Expo Go : c'est un stockage différent, à revalider. |
| **La connexion du compte de démonstration** (sans 2FA) | Un blocage ici = rejet certain. |
| **Le mode avion** pendant un scan | Vérifie l'écran « Pas de réseau ». |
| **Le lien « Ouvrir le tableau de bord »** | Doit ouvrir Safari sur `app.halocard.ch/dashboard`. |
| **L'application en arrière-plan puis au premier plan** | La session se rafraîchit, la caméra se rallume. |

---

## 8. Récapitulatif des marqueurs à remplacer

| Fichier | Marqueur | Qui le remplit |
|---|---|---|
| `mobile/app.json` | `extra.eas.projectId` (absent) | Écrit automatiquement par `eas init` — à committer |
| `mobile/eas.json` | `appleId` | Vous, §2.7 |
| `mobile/eas.json` | `ascAppId` | Vous, après création de la fiche (§2.6) |
| `mobile/eas.json` | `appleTeamId` | Vous, §2.7 |
| App Store Connect | Compte de démonstration | Vous, **jamais dans le dépôt** |
| App Store Connect | QR de test en pièce jointe | Vous, §6.2 |

---

## 9. Android, en une phrase

La configuration Android est prête (même identifiant, icône adaptative, et
`android.permission.CAMERA` comme seule permission ajoutée par l'application —
`RECORD_AUDIO` a été explicitement écartée). La publication sur Google Play suit
une logique différente — compte développeur à 25 $ une fois, fiche Play Console,
mêmes déclarations de confidentialité — et n'est pas couverte ici.

**Un point à traiter le jour où vous viserez Google Play** : le gabarit Android
d'Expo ajoute de lui-même des permissions dont l'application ne se sert pas —
`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`. Elles
sont sans effet sur iOS et n'ont donc pas été touchées ici, mais Google interroge
sur certaines d'entre elles. Elles se retirent avec la clé
`android.blockedPermissions` dans `app.json`, à valider par un vrai build
Android — ce qui n'a pas pu être fait dans cette livraison.
