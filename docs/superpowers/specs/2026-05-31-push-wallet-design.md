# Spec — Module 3 : Canal Push Wallet (notifications sans SMS)

**Date** : 2026-05-31
**Statut** : Approche validée en brainstorming, à relire avant plan d'implémentation
**Périmètre** : 3ᵉ module de la suite marketing du dashboard marchand. Canal de notifications via Apple/Google Wallet, plus interface d'envoi marchand.

---

## Contexte

La suite marketing du dashboard marchand est découpée en 5 modules (analytique →
segmentation → **push wallet** → campagnes → IA). Le Module 1 (analytique) est livré.
Ce module construit le **canal de notifications push via le wallet** (Apple/Google),
le moyen « zéro SMS » d'atteindre les clients. Les modules suivants (campagnes,
anniversaire, rappels inactifs) **utiliseront** ce canal ; ici on construit le canal
+ une interface d'envoi de base.

Le projet a déjà des passes Apple (LIVE) et Google (techniquement OK) générés par
`src/lib/applePass.ts` et `src/lib/googlePass.ts`. **Aujourd'hui les passes n'ont
PAS de `webServiceURL`/`authenticationToken`** → aucune mise à jour push possible.

## Décisions de cadrage (validées)

- **Les deux comportements** : (1) « carte vivante » = mise à jour silencieuse de la
  carte au scan ; (2) « message/annonce » = notification visible envoyée par le marchand.
- **Canal + interface d'envoi** : le marchand a un écran « Envoyer une notification »
  (diffusion à tous ses clients push-ready). Ciblage fin = Modules 2/4.
- **Apple d'abord**, via une abstraction `NotificationChannel` ; adaptateur **Google
  branché mais désactivé** tant que l'émetteur Google est en mode démo.
- **Cartes push-ready à partir de maintenant** : les nouvelles cartes embarquent
  `webServiceURL` + `authenticationToken`. Les anciennes ne reçoivent rien jusqu'au
  ré-ajout ; on fournit au marchand un **lien de ré-ajout** à partager (pas de migration forcée).
- **APNs avec le certificat Pass Type ID existant** (`signerCert`/`signerKey`), pas de
  nouveau credential.

## Hors périmètre

- **Google Wallet en production** : l'adaptateur Google est écrit mais l'envoi reste
  désactivé (flag) tant que l'accès « publishing » n'est pas accordé (action console).
- **Segmentation** (Module 2) et **campagnes/automatisation** — anniversaire, rappels
  inactifs, déclencheurs programmés (Module 4). Ici : diffusion manuelle à tous.
- Planification/scheduling des envois, A/B, statistiques d'ouverture.

---

## Modèle de données

**Migration `loyalty_cards`** (par carte) :
- `auth_token TEXT` — secret par carte pour authentifier le service web Apple. Généré à
  la 1ʳᵉ génération d'un pass push-ready.
- `pass_message TEXT` — dernier message affiché sur la carte (mis à jour à chaque envoi).
- `pass_updated_at TIMESTAMPTZ` — horodatage de dernière modification du pass (sert au
  endpoint « cartes mises à jour depuis »). Bumpé au scan et à l'envoi de message.

**Nouvelle table `wallet_device_registrations`** (un appareil ↔ une carte) :
```sql
CREATE TABLE wallet_device_registrations (
  id uuid primary key default uuid_generate_v4(),
  device_library_id text not null,
  pass_type_id text not null,
  serial_number text not null,         -- = loyalty_cards.id (cardId)
  push_token text not null,
  created_at timestamptz default now(),
  unique (device_library_id, serial_number)
);
CREATE INDEX idx_wdr_serial ON wallet_device_registrations (pass_type_id, serial_number);
CREATE INDEX idx_wdr_device ON wallet_device_registrations (device_library_id);
```

**Nouvelle table `wallet_notifications`** (historique des envois marchand) :
```sql
CREATE TABLE wallet_notifications (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid references merchants(id) on delete cascade,
  title text not null,
  body text not null,
  sent_count int not null default 0,
  created_at timestamptz default now()
);
```

RLS : `wallet_notifications` scopée marchand (comme les autres tables). Les tables de
registration sont écrites par le service web Apple (clé service-role / route serveur),
pas exposées au client.

---

## Passe « push-ready » (modif `applePass.ts`)

Ajouts à `pass.json` :
- `webServiceURL` = `${BASE_URL}/api/wallet/apple` (base du service web PassKit).
- `authenticationToken` = `auth_token` de la carte (généré + stocké si absent).
- Un champ message dans `storeCard.backFields` (et un `headerFields`/secondary visible) :
  `{ key: "message", label: "INFO", value: <pass_message ou "">, changeMessage: "%@" }`.
  Apple affiche une **notification** quand la valeur d'un champ avec `changeMessage` change.

`BASE_URL` vient d'une env (`NEXT_PUBLIC_BASE_URL` / `APPLE_WEB_SERVICE_URL`), défaut
`https://carte-fidelite-nu.vercel.app`.

`buildApplePassBuffer` prend désormais aussi `authToken` + `message` (ou les lit/génère
via la carte). Le helper qui génère un pass pour une carte garantit `auth_token` en base.

---

## Service web PassKit (endpoints Apple obligatoires)

Base `/api/wallet/apple`. En-tête d'auth : `Authorization: ApplePass <auth_token>` —
validé contre `loyalty_cards.auth_token` du `serialNumber`.

| Méthode & route | Rôle |
|---|---|
| `POST /v1/devices/{deviceLibraryId}/registrations/{passTypeId}/{serial}` | Enregistre l'appareil (body `{pushToken}`) : insert dans `wallet_device_registrations`. 201 (nouveau) / 200 (existant). |
| `DELETE /v1/devices/{deviceLibraryId}/registrations/{passTypeId}/{serial}` | Désenregistre : delete. 200. |
| `GET /v1/devices/{deviceLibraryId}/registrations/{passTypeId}?passesUpdatedSince={tag}` | Liste les `serialNumbers` des cartes modifiées depuis `tag` + `lastUpdated`. 200 / 204 si aucune. |
| `GET /v1/passes/{passTypeId}/{serial}` (header auth, `If-Modified-Since`) | Renvoie le `.pkpass` à jour (reconstruit avec `pass_message`/`stamps`). 200 / 304 si inchangé. |
| `POST /v1/log` | Logs de debug Apple. 200 (optionnellement journalisés). |

Routes Next (App Router, segments dynamiques imbriqués) :
```
src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts   (POST, DELETE)
src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts            (GET serials)
src/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route.ts                             (GET latest, runtime nodejs)
src/app/api/wallet/apple/v1/log/route.ts                                                      (POST)
```

`tag` (passesUpdatedSince) = epoch ms en string ; on renvoie comme `lastUpdated` le max
des `pass_updated_at` ; on filtre `pass_updated_at > tag`.

---

## Envoi APNs (`src/lib/wallet/apns.ts`)

- HTTP/2 vers `https://api.push.apple.com/3/device/{pushToken}` (prod) / `api.sandbox...`.
- TLS **client cert** = `signerCert` + `signerKey` (+ passphrase `SIGNER_KEY_PASSPHRASE`),
  chargés comme dans `applePass.ts` (env base64 ou fichiers `certs/`).
- En-têtes : `apns-topic: {passTypeId}`, `apns-push-type: background`, `apns-priority: 5`.
- Payload : `{}` (vide) — c'est un ping « ta carte a changé », le téléphone rappelle
  ensuite « get latest pass ».
- `sendPush(pushTokens: string[])` : ouvre une session http2, envoie en parallèle borné,
  retourne `{ ok, failedTokens }`. Les tokens invalides (410/BadDeviceToken) sont
  supprimés de `wallet_device_registrations`.
- Fonction pure testable `buildApnsRequest(pushToken, passTypeId)` → `{ path, headers, body }`.

---

## Abstraction canal (`src/lib/wallet/channel.ts`)

```ts
export interface NotificationChannel {
  // met à jour les cartes (message optionnel) et pousse la notif
  notify(cardIds: string[], message?: { title: string; body: string }): Promise<{ pushed: number }>;
}
```
- **AppleChannel** : pour chaque carte → si `message`, set `pass_message` (titre + corps),
  bump `pass_updated_at`, push APNs vers les `push_token` enregistrés. Sans `message` =
  mise à jour silencieuse (carte vivante) : bump `pass_updated_at` + push.
- **GoogleChannel** : appelle l'API Google Wallet (`loyaltyobject.patch` / `addmessage`)
  — **désactivé** derrière `GOOGLE_PUSH_ENABLED` (false par défaut, démo).
- `getChannels()` retourne les canaux actifs (Apple toujours ; Google si flag).

## Flux d'envoi

**Message marchand** : `POST /api/notifications/send` (auth marchand) body `{title, body}`
→ récupère les cartes push-ready du marchand (celles ayant ≥1 registration) → `channel.notify(cardIds, {title, body})` → insère une ligne `wallet_notifications` (sent_count) → renvoie le compte.

**Carte vivante au scan** : dans la route de scan existante (`/api/scan`), après mise à
jour des tampons, appeler `channel.notify([cardId])` (silencieux) en best-effort
(try/catch, n'échoue pas le scan).

## Interface marchand

- Nouvel onglet **« Notifications »** dans `DashboardShell` (`/dashboard/notifications`).
- Formulaire : titre + message + aperçu ; bouton « Envoyer à mes clients » ; affiche le
  nombre de clients joignables (cartes push-ready) et le résultat (X notifications envoyées).
- Historique simple : liste des `wallet_notifications` (titre, date, nombre envoyé).
- **Lien de ré-ajout** : un bouton « Inviter mes clients à réinstaller leur carte »
  copie le lien d'ajout au wallet existant (les passes regénérés sont push-ready).

## Robustesse, sécurité, erreurs

- Service web : auth par `authenticationToken` par carte (comparaison constante) ; 401 si
  invalide ; 404 si carte inconnue.
- APNs best-effort : un échec d'envoi ne casse ni le scan ni la requête marchand ; tokens
  morts purgés.
- Idempotence registration via la contrainte `unique(device_library_id, serial_number)`.
- `runtime = "nodejs"` sur les routes qui font http2/APNs et la génération `.pkpass`.
- Secrets : certs déjà gérés (env base64) ; pas de nouveau secret sauf `APPLE_WEB_SERVICE_URL` (optionnel).

## Tests

- **Pure / unitaire (Vitest)** :
  - `buildApnsRequest` : path/headers/payload corrects.
  - filtre « serials modifiés depuis tag ».
  - construction `pass.json` push-ready : présence de `webServiceURL`, `authenticationToken`,
    champ `message` avec `changeMessage`.
  - validation de l'en-tête `Authorization: ApplePass` (parse + compare).
  - `getChannels()` : Apple actif ; Google exclu si flag off.
- **Endpoints / intégration** : vérifiés par `npm run build` + fumée manuelle (ajout d'une
  carte push-ready sur un vrai iPhone, envoi d'un message, réception de la notif).

## Plan de livraison suggéré

1. Migration (colonnes carte + 2 tables).
2. `applePass.ts` push-ready (webServiceURL, authToken, champ message) + génération auth_token.
3. APNs sender (`apns.ts`) + tests purs.
4. Service web PassKit (4 endpoints) + auth.
5. Abstraction canal + AppleChannel ; GoogleChannel (désactivé).
6. `POST /api/notifications/send` + intégration scan (carte vivante).
7. UI marchand « Notifications » + onglet + lien de ré-ajout.
8. Vérif finale (tests + build + fumée iPhone).

## Points ouverts

- Confirmer `BASE_URL` de prod pour `webServiceURL` (défaut `https://carte-fidelite-nu.vercel.app`).
- APNs prod vs sandbox : les passes signés en prod utilisent `api.push.apple.com` (prod).
- Affichage exact du message : champ `backFields` (au dos) + notification ; on garde simple
  (un seul champ message écrasé à chaque envoi).
