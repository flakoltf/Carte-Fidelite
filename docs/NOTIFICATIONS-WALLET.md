# Notifications Apple Wallet — comment ça marche, comment tester

> Rédigé le 2026-07-10 (diagnostic « message commerçant invisible sur iPhone »).
> Public : le fondateur, avant chaque démo ou test terrain.

## Le bug corrigé (contexte)

Quand un marchand a un **design de carte enregistré** (studio), le pass
reconstruit après un envoi ne contenait plus le champ `message` porteur du
`changeMessage` — iOS re-téléchargeait bien la carte, mais sans champ modifié
à annoncer : **aucune bannière, et le message n'apparaissait même pas au dos
de la carte**. Corrigé dans `src/lib/wallet/passJson.ts` (le champ INFO est
réinjecté en tête des backFields sur le chemin design).

Tous les comptes démo ayant un design, **aucun** envoi n'était visible avant
ce correctif — quel que soit l'iPhone.

## Le VRAI blocage de la bannière (correctif du 2026-07-10)

Le correctif ci-dessus a rendu le message visible **au dos** de la carte, mais
la **bannière sur l'écran verrouillé** ne s'affichait toujours pas — alors que
tout le transport était bon (appareil enregistré, `push_token` valide, APNs
HTTP 200, `apns-push-type: alert` + `apns-priority: 10`, valeur du message
réellement modifiée à chaque envoi, pass reconstruit). Le champ porteur du
`changeMessage` était un **backField** (au DOS, clé `message`, label « INFO »).

**Enquête (sources ci-dessous) : Apple ne fiabilise la bannière écran-verrouillé
que pour un champ VISIBLE À L'AVANT.** Un `changeMessage` posé sur un champ du
DOS n'est PAS un déclencheur fiable de bannière.

### Ce que l'enquête a établi

1. **Le mécanisme officiel (Apple).** À chaque mise à jour, « the device
   compares the latest version of the pass against the version it had before to
   determine which fields have changed. If the value of a field has changed and
   the field specifies a change message, the device shows the message ». Donc
   trois conditions cumulatives : (a) le champ existe des deux côtés et sa
   **valeur change**, (b) le champ porte un `changeMessage`, (c) — implicite,
   confirmé par les implémentations — `changeMessage` contient le jeton `%@`.
   Source : Apple *Wallet Developer Guide — Updating a Pass*
   (`developer.apple.com/library/archive/.../PassKit_PG/Updating.html`).

2. **AVANT vs DOS (le point décisif).** La doc Apple est muette sur AVANT/DOS,
   mais le consensus des fournisseurs Wallet et des retours terrain est net :
   *« Front-of-pass value changes are visually indicated (circled) upon lock
   screen notification tap. Back-of-pass (pass details) value changes are not
   visually indicated. »* — et, côté fiabilité de la bannière elle-même, poser
   le `changeMessage` sur un champ du DOS ne produit pas la bannière écran
   verrouillé de manière fiable. C'est exactement notre symptôme.
   Source (fournisseur, à distinguer de la doc officielle) : PassKit,
   *Sending Lock Screen Notifications* et *How to engage your customers with the
   Apple Wallet changeMsg* (`help.passkit.com`, `passkit.com/blog`).

3. **Champ ABSENT → PRÉSENT (le piège du premier envoi).** Apple diffe par
   `key`. Un champ qui n'existait pas dans l'ancien pass et apparaît dans le
   nouveau n'a **pas de valeur précédente** à comparer : plusieurs
   implémentations rapportent que ce premier passage **peut ne pas déclencher**
   la bannière. Conséquence pratique : le premier message JAMAIS envoyé à une
   carte donnée est le cas le moins fiable ; **tous les envois suivants**
   (valeur A → valeur B sur un champ déjà présent) déclenchent, eux, de façon
   fiable. Chez nous `loyalty_cards.pass_message` est **persistant** (jamais
   remis à zéro par les rafraîchissements silencieux) : dès le 2ᵉ message le
   champ est présent→présent. Source (retours d'implémentation, moindre autorité
   que la doc Apple) : Passcreator / Airship / forums PassKit.

4. **Valeur identique = pas de bannière.** Déjà connu (piège n°3 ci-dessous) :
   réenvoyer le même texte ne rejoue pas la bannière.

### Le correctif appliqué

Dans `src/lib/wallet/passJson.ts`, fonction `applyMerchantMessage` :

- Le message commerçant est désormais posé sur un **champ AVANT** : un
  `auxiliaryField` (clé `passmsg`, label « MESSAGE ») avec `changeMessage: "%@"`.
  **C'est lui, et lui seul, qui porte la bannière.**
- Ce champ n'est présent **que si `pass_message` est non vide** → aucun champ
  vide permanent, le recto « sobre » (#54/#49) reste intact hors message.
- **Choix de la zone `auxiliary`** (et pas les autres emplacements avant) :
  - `header` : volontairement **vide** (collision device-prouvée le 2026-07-03
    avec le wordmark + la devise sur la ligne du haut). Exclu.
  - `primary` : plein (compteur unique, limite Apple = 1).
  - `secondary` : la « RÉCOMPENSE » (couche identité) y vit au **moment magique**
    de la récompense ; y ajouter le message risquerait une collision 3 colonnes
    pile quand ça compte le plus.
  - `auxiliary` : ligne basse, labels courts, place libre (kit démo : 2/4 ;
    legacy : 0/4). Le message est mis **en tête** (le plus visible) et la zone
    est bornée à la limite Apple (≤ 4).
- Le message reste **au DOS** (champ « INFO ») pour consultation, mais **sans**
  `changeMessage` : une seule source de bannière, pas de double notification.
- Compromis assumé : sur un design custom déjà à 4 auxiliaires, le message prend
  la place du dernier auxiliaire **le temps de l'alerte** (la bannière prime
  quand le commerçant vient d'agir). Le kit démo laisse exprès la place (2/4).

### Sources

- Apple — *Wallet Developer Guide: Updating a Pass* :
  https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html
- Apple — *PassFieldContent* (référence de champ) :
  https://developer.apple.com/documentation/walletpasses/passfieldcontent
- PassKit — *Sending Lock Screen Notifications* :
  https://help.passkit.com/en/articles/4097979-sending-lock-screen-notifications
- PassKit — *How to engage your customers with the Apple Wallet changeMsg* :
  https://passkit.com/blog/how-to-engage-your-customers-with-the-apple-wallet-changemsg/
- Passcreator — *Apple Wallet pass updates and push notifications* :
  https://www.passcreator.com/en/blog/apple-wallet-pass-updates-and-push-notifications-how-they-work-and-how-to-use-them
- WalletWallet — *Anatomy of an Apple Wallet Pass* :
  https://www.walletwallet.dev/blog/anatomy-of-an-apple-wallet-pass/

## Les 3 pièges iOS à connaître (comportement Apple, pas des bugs)

1. **La bannière ne s'affiche que sur l'écran VERROUILLÉ.**
   Pas de bannière si le téléphone est déverrouillé en cours d'usage, et la
   notification ne laisse **aucune trace dans le centre de notifications**.
   Pour la voir : verrouiller l'iPhone AVANT l'envoi, attendre, regarder
   l'écran verrouillé.

2. **Le réglage par-carte doit être actif.**
   Dos de la carte (bouton ⓘ ou « … ») → « Autoriser les notifications »
   doit être coché. Il est actif par défaut, mais un doigt malheureux le
   coupe définitivement pour cette carte.

3. **`changeMessage` ne se déclenche que si la VALEUR du champ CHANGE.**
   Envoyer deux fois le même texte ne produit qu'UNE bannière (la première).
   Piège de test classique : re-envoyer « Test » pour « re-vérifier » → rien.
   **Varier le message à chaque essai** (« Test 1 », « Test 2 », …).

## Checklist de test device (dans l'ordre)

- [ ] La carte est installée dans Apple Wallet **depuis le flux d'enrôlement**
      (QR `/c/[slug]`) et l'iPhone a du réseau.
- [ ] Vérifier l'enregistrement : dashboard → Messages clients → le compteur
      doit afficher au moins 1 client joignable. S'il affiche 0, l'appareil
      n'est pas enregistré → réinstaller la carte.
- [ ] Dos de la carte → « Autoriser les notifications » actif.
- [ ] **Verrouiller l'iPhone.**
- [ ] Envoyer un message **différent des envois précédents** depuis le
      dashboard.
- [ ] Attendre jusqu'à ~1 minute (push APNs + re-téléchargement du pass).
- [ ] La bannière apparaît sur l'écran verrouillé. Sur la carte, le message
      apparaît sur un champ AVANT « MESSAGE » (auxiliaire, bas de la carte) et
      reste consultable au dos, champ « INFO ».
- [ ] **Premier message d'une carte neuve** : c'est le cas le moins fiable
      (champ absent → présent, cf. enquête §3). Si la bannière ne sort pas au
      1ᵉʳ essai, renvoyer un **2ᵉ texte différent** : le champ existe désormais,
      la bannière sort de façon fiable. Toujours tester avec ≥ 2 textes distincts.
- [ ] En cas d'échec : re-tester avec un NOUVEAU texte avant de conclure.

## Où regarder si ça ne marche toujours pas

- `wallet_notifications.sent_count` (Supabase) : 0 = aucun push parti
  (appareil non enregistré ou tokens morts purgés).
- `wallet_device_registrations` : la carte testée doit y avoir une ligne.
- Logs Vercel : `[ApplePass log]` = les iPhone postent leurs erreurs sur
  `/api/wallet/apple/v1/log` (compteur seulement, corps non journalisé).
