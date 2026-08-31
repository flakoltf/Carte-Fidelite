# Dette technique — système de jetons du Card Design Studio

> Consignée le 2026-09-01, à la suite du diagnostic « jeton brut sur carte émise »
> (cas réel : `{palier}` affiché en accolades au client final d'une carte à
> points sous son premier palier). La **couche 1** (repli serveur : un jeton
> connu non résolvable disparaît du pass, jamais d'accolades) est corrigée —
> voir `resolveTokens` / `buildPassJson` (`src/lib/wallet/passJson.ts`) et
> `mapToGoogleClass` (`src/lib/cardDesign/mapGoogle.ts`). Les trois couches
> ci-dessous sont IDENTIFIÉES mais volontairement NON traitées (proximité de la
> soutenance — pas de chantier structurel ouvert).

## 1. L'écart aperçu / serveur (le cœur du problème)

**Les aperçus mentent par construction.** La résolution des jetons existe en
QUATRE implémentations indépendantes :

| Où | Fonction | Données |
|---|---|---|
| Pass Apple émis (serveur) | `resolveTokens` — `src/lib/wallet/passJson.ts` | valeurs RÉELLES, **conditionnelles** (type de programme, état du client) |
| Aperçus Studio Apple+Google | `resolve()` locale — `WalletPreviews.tsx` | échantillons **statiques** (`DEFAULT_SAMPLE` / sample de `StudioClient`) |
| Aperçus admin Apple+Google | `resolve()` dupliquée — `ApplePassPreview.tsx` / `GooglePassPreview.tsx` | `DEMO_SAMPLE` statique |
| Classe Google (Android) | aucune résolution (repli couche 1 : jetons connus retirés) | — |

Conséquence : l'aperçu affiche toujours « Argent » pour `{palier}` alors que le
serveur ne le résout que si un palier est atteint **dans le cycle en cours**
(points) ou pour un programme tiered. Chaque nouveau jeton doit être câblé dans
~6 endroits ; l'écart reviendra à chacun tant que les aperçus n'appliquent pas
les MÊMES conditions que le serveur.

## 2. Pas de garde-fou au Studio

La liste `TOKENS` (`FieldsSection.tsx`) est statique et identique pour tous les
types de carte : rien n'empêche un commerçant d'insérer `{palier}` sur une carte
à tampons ou `{progression}` sur un programme tiered — jetons irrésolvables dans
ces contextes (désormais silencieusement retirés du pass par la couche 1, ce qui
reste une surprise pour le commerçant). La prod contient déjà de telles
combinaisons. À faire : filtrer/griser les jetons selon `cardType`/programme +
avertissement `studioValidation` à la publication.

## 3. Pas de registre unifié

`KNOWN_TOKENS` (`src/lib/cardDesign/types.ts`, posé par la couche 1) n'est pour
l'instant qu'une LISTE de noms. Le registre complet (nom, hint Studio,
conditions de résolution, échantillon d'aperçu) reste éclaté entre
`FieldsSection`, `WalletPreviews`, les previews admin, `applePass` et
`passJson`. Cible : un module unique source de vérité consommé par toutes ces
surfaces — c'est le prérequis propre des points 1 et 2.

## Rappel canal Google

Les champs texte du design partent dans la **classe** Google, partagée entre
tous les clients d'un marchand : un jeton par-client y est irrésolvable par
construction. Le vrai correctif est de porter ces champs sur l'**objet**
par-client (résolus à l'émission, puis mis à jour au scan via GET-then-merge) —
chantier déjà listé au reste-à-faire, dépendant du publishing access Google.
