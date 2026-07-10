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
- [ ] La bannière apparaît sur l'écran verrouillé ; le texte est aussi
      visible au dos de la carte, champ « INFO ».
- [ ] En cas d'échec : re-tester avec un NOUVEAU texte avant de conclure.

## Où regarder si ça ne marche toujours pas

- `wallet_notifications.sent_count` (Supabase) : 0 = aucun push parti
  (appareil non enregistré ou tokens morts purgés).
- `wallet_device_registrations` : la carte testée doit y avoir une ligne.
- Logs Vercel : `[ApplePass log]` = les iPhone postent leurs erreurs sur
  `/api/wallet/apple/v1/log` (compteur seulement, corps non journalisé).
