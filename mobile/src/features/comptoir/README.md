# Comptoir (app mobile)

Onglet de travail du commerçant : on scanne la carte du client, on voit le
résultat en grand, on encaisse la récompense d'un geste, on peut annuler tout
de suite. Tout le reste — cooldown, plafond, récompense, propriété de la
carte — est décidé par le serveur.

## Contrat d'API

Un seul endroit appelle le réseau : `scanApi.ts`, via le client central
`@/lib/api` (qui attache `Authorization: Bearer <jeton de session>`) — plus
`stats.ts` pour le 3ᵉ chiffre du jour (voir plus bas).

### `POST /api/scan` — créditer (`src/app/api/scan/route.ts`)

Corps : `{ cardId }` où `cardId` est le **payload brut du QR** (signé). C'est le
serveur qui vérifie la signature et en extrait l'identifiant réel. Pour un
marchand `amount_points`, le pavé CHF renvoie le MÊME appel avec
`{ cardId, amountChf }` — bornes serveur : > 0, ≤ 10 000, 2 décimales max
(`montantRules.ts` les tient déjà à la saisie, le serveur revalide).

Succès `200`, selon la mécanique du marchand :

| Mécanique | Réponse |
|---|---|
| `stamp_card` · `visit_based` · `tiered` | `{ success, card: { stamps_count, customers }, stampGoal, loyaltyType, rewardReady, rewardUnlocked, added, events }` — carte déjà pleine : `added: false`, `rewardReady: true` |
| `points` | `{ success, loyaltyType: "points", currentValue, pointsAdded, added, rewardReady, redeemableTiers, maxThreshold }` |
| `amount_points` | `{ success, currentValue, pointsEarned, rewardReady, rewardLabel }` — **aucun `loyaltyType`** dans la réponse |

Refus :

| Statut | Cas | Écran |
|---|---|---|
| `429` + `{ cooldown: true }` | même carte scannée à l'instant | « Déjà scanné il y a un instant » |
| `429` sans `cooldown` | plafond de 200 scans/minute | refus, message du serveur |
| `404` | carte introuvable | « Carte inconnue » |
| `400` | QR forgé | refus, message du serveur |
| `400` « montant en CHF requis » | marchand `amount_points`, scan sans montant | pavé numérique CHF, puis renvoi du même scan avec `amountChf` |
| `403` | carte d'un autre établissement · compte suspendu | refus, message du serveur |
| `401` | session expirée | refus, message du serveur |
| `0` (client) | réseau coupé | « Pas de réseau — le crédit n'a pas été enregistré » |

### `POST /api/scan/revert` — annuler le dernier crédit

Corps : `{ cardId }`. Décision atomique par la RPC `scan_revert` : fenêtre de
**5 minutes**, jamais sous zéro, jamais après un encaissement. `200` → annulé ;
`409` → fenêtre dépassée ou rien à annuler ; `404` → carte introuvable. L'app
affiche le message du serveur tel quel.

### `POST /api/scan/redeem` — encaisser la récompense

Même contrat que le comptoir web (`RedeemFullScreen`) : `{ cardId }` pour un
seul bouton OFFRIR (tampons, `amount_points`), `{ cardId, tierThreshold }` pour
valider UN palier d'une carte à points (le palier max remet le cycle à zéro,
`cycleReset: true` dans la réponse). La décision — carte pleine, palier
atteint, déjà offert — appartient à la logique partagée
`src/lib/loyalty/redeem.ts` (atomique + audit `REWARD_REDEEMED`) ; l'app relaie
le verdict tel quel. `visit_based` / `tiered` n'ont pas d'encaissement :
l'écran récompense reste purement informatif pour eux.

## Ce que l'app décide (et ce qu'elle ne décide pas)

Elle **n'évalue** ni seuil, ni compteur, ni fenêtre : `scanContract.ts` ne fait
que *lire* la réponse — y compris les paliers encaissables (`redeemableTiers`),
jamais recalculés. Trois exceptions assumées, toutes trois d'affichage :

1. **`revertRules.ts`** — miroir de `src/lib/loyalty/revert.ts` (le mobile ne
   peut pas importer le code du web). Sert à savoir s'il faut *proposer* le
   bandeau et avec quels mots ; la RPC reste seule juge. Ses tests reprennent
   les attentes du web : si la règle change là-bas, ils tombent ici.
2. **`montantRules.ts`** — miroir des bornes du serveur pour le pavé CHF
   (> 0, ≤ 10 000, 2 décimales max) et de la saisie du web
   (`src/lib/comptoir/amountPad.ts`). Confort de saisie : le serveur revalide.
3. **Relecture ignorée pendant 3 s** — le même QR reste devant l'objectif après
   un crédit ; sans cela, chaque scan serait suivi d'un « déjà scanné ». Le
   cooldown serveur reste la vraie garde anti-double-crédit.

## Les chiffres du jour

`stats.ts` compte deux choses avec la session du commerçant (clé anon + RLS
`cards/scans scoped to merchant`), avec les mêmes fenêtres que
`src/lib/comptoir/stats.ts` : **scans sur 24 h glissantes** et **cartes actives
sur 90 jours** (CGV §1).

Le 3ᵉ chiffre, « **récompenses dues** », n'est PAS compté ici : il exige de
résoudre le programme de fidélité (`resolveLoyaltyProgram`, précédence
`loyalty_config.goal` → `stamp_goal`) — de la logique métier que le mobile ne
recode jamais. Il est lu tel quel sur la route Bearer
`GET /api/comptoir/rewards-due`, qui fait ce comptage côté serveur avec la même
définition que le comptoir web. Route en panne → 0, jamais un comptoir bloqué.

## Limites connues

- **Simulateur iOS** : pas de caméra — le viseur y est noir et aucun QR ne peut
  être lu. Les états de résultat des captures ont été rendus par les composants
  réels, montés directement.

Les deux limites historiques sont levées : le crédit au montant a son **pavé
numérique CHF** (plus de renvoi vers l'ordinateur), et l'écran « Récompense
atteinte » **encaisse** — confirmation explicite, haptique de succès, erreurs
et hors-ligne avec « Réessayer », choix du palier pour les cartes à points.

## Fichiers

```
comptoir/
├── ComptoirScreen.tsx      orchestration : viseur, résultat, encaissement,
│                           pavé CHF, annulation, chiffres
├── scanContract.ts         réponse serveur → état d'écran (pur)
├── scanApi.ts              appels /api/scan, /api/scan/revert, /api/scan/redeem
├── revertRules.ts          miroir des règles d'annulation du web (pur)
├── montantRules.ts         miroir des bornes CHF du serveur (pur)
├── stats.ts                comptages du jour (pur, clients injectés)
├── useComptoirStats.ts     relecture à chaque retour sur l'onglet
└── components/             Viseur · ResultatPleinEcran · EncaissementRecompense ·
                            PaveMontant · BandeauAnnuler · ChiffresDuJour ·
                            DemandePermission
```
