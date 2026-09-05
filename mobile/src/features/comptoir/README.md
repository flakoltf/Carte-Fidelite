# Comptoir (app mobile)

Onglet de travail du commerçant : on scanne la carte du client, on voit le
résultat en grand, on peut annuler tout de suite. Tout le reste — cooldown,
plafond, récompense, propriété de la carte — est décidé par le serveur.

## Contrat d'API

Un seul endroit appelle le réseau : `scanApi.ts`, via le client central
`@/lib/api` (qui attache `Authorization: Bearer <jeton de session>`).

### `POST /api/scan` — créditer (`src/app/api/scan/route.ts`)

Corps : `{ cardId }` où `cardId` est le **payload brut du QR** (signé). C'est le
serveur qui vérifie la signature et en extrait l'identifiant réel.

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
| `400` « montant en CHF requis » | marchand `amount_points` | renvoi vers l'ordinateur (voir plus bas) |
| `403` | carte d'un autre établissement · compte suspendu | refus, message du serveur |
| `401` | session expirée | refus, message du serveur |
| `0` (client) | réseau coupé | « Pas de réseau — le crédit n'a pas été enregistré » |

### `POST /api/scan/revert` — annuler le dernier crédit

Corps : `{ cardId }`. Décision atomique par la RPC `scan_revert` : fenêtre de
**5 minutes**, jamais sous zéro, jamais après un encaissement. `200` → annulé ;
`409` → fenêtre dépassée ou rien à annuler ; `404` → carte introuvable. L'app
affiche le message du serveur tel quel.

## Ce que l'app décide (et ce qu'elle ne décide pas)

Elle **n'évalue** ni seuil, ni compteur, ni fenêtre : `scanContract.ts` ne fait
que *lire* la réponse. Deux exceptions assumées, toutes deux d'affichage :

1. **`revertRules.ts`** — miroir de `src/lib/loyalty/revert.ts` (le mobile ne
   peut pas importer le code du web). Sert à savoir s'il faut *proposer* le
   bandeau et avec quels mots ; la RPC reste seule juge. Ses tests reprennent
   les attentes du web : si la règle change là-bas, ils tombent ici.
2. **Relecture ignorée pendant 3 s** — le même QR reste devant l'objectif après
   un crédit ; sans cela, chaque scan serait suivi d'un « déjà scanné ». Le
   cooldown serveur reste la vraie garde anti-double-crédit.

## Les chiffres du jour

`stats.ts` compte deux choses avec la session du commerçant (clé anon + RLS
`cards/scans scoped to merchant`), avec les mêmes fenêtres que
`src/lib/comptoir/stats.ts` : **scans sur 24 h glissantes** et **cartes actives
sur 90 jours** (CGV §1).

Le 3ᵉ chiffre du web, « récompenses dues », n'est **pas** repris : il faudrait
résoudre le programme de fidélité (`resolveLoyaltyProgram`, précédence
`loyalty_config.goal` → `stamp_goal`) et donc dupliquer de la logique métier.
Il reviendra le jour où une route Bearer exposera ce comptage.

## Limites connues

- **`amount_points`** : le crédit au montant demande un pavé numérique, absent
  de cette mission. Le serveur répond `400` et l'app affiche un état dédié qui
  renvoie vers le comptoir sur ordinateur.
- **Encaisser une récompense** : `/api/scan/redeem` n'est pas ouvert au jeton
  Bearer. L'écran « Récompense atteinte » informe, il n'encaisse pas.
- **Simulateur iOS** : pas de caméra — le viseur y est noir et aucun QR ne peut
  être lu. Les états de résultat des captures ont été rendus par les composants
  réels, montés directement.

## Fichiers

```
comptoir/
├── ComptoirScreen.tsx      orchestration : viseur, résultat, annulation, chiffres
├── scanContract.ts         réponse serveur → état d'écran (pur)
├── scanApi.ts              appels /api/scan et /api/scan/revert
├── revertRules.ts          miroir des règles d'annulation du web (pur)
├── stats.ts                comptages du jour (pur, client injecté)
├── useComptoirStats.ts     relecture à chaque retour sur l'onglet
└── components/             Viseur · ResultatPleinEcran · BandeauAnnuler ·
                            ChiffresDuJour · DemandePermission
```
