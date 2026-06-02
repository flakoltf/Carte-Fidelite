# Proximité GPS (géofence Wallet) — Design

**Date :** 2026-06-02
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)

## Objectif

Faire remonter la carte de fidélité du client **quand il est à proximité de la boutique**, via le mécanisme **natif** des pass Apple/Google (`locations`) — sans application tierce. Différenciateur face au concurrent emuna (qui ne propose pas de proximité).

**Réalité technique (assumée) :** le rayon est contrôlé par l'OS (~100 m, pas « quelques mètres ») ; sur iPhone la carte remonte sur l'écran verrouillé avec un texte de pertinence, ce n'est pas un push sonore personnalisé. Le « vrai quelques mètres » relèvera de l'iBeacon (option premium, hors de ce sous-projet).

## Décisions validées (brainstorming)

1. **Saisie par adresse → géocodage** (pas de coords brutes ni de carte interactive).
2. **Éditable par le marchand (self-service) ET par l'admin.**
3. **Approche A** : Nominatim/OpenStreetMap (gratuit, sans clé) + fallback saisie manuelle ; logique pure testée ; injection dans pass Apple **et** Google.

## Périmètre

**Inclus** : champ adresse sur `merchants` + géocodage, `locations` sur les pass Apple & Google, UI marchand (`/dashboard/settings`) et admin (`/admin/merchants/[id]`), refresh des pass existants, `relevantText` par défaut, validation.

**Hors périmètre (YAGNI / plus tard)** : iBeacon / proximité « quelques mètres » (module premium B), carte interactive (pin), `relevantText` personnalisable, multi-positions, réglage du rayon (`maxDistance`), géocodeur payant (Google).

## 1. Modèle de données (1 migration)

Migration `supabase/migrations/20260602_merchant_location.sql` — appliquée en prod (`oqcelbbozpykwkasjtqy`) par le contrôleur **avec consentement**.
```sql
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
```
Coords nulles → aucune `locations` sur le pass (comportement actuel inchangé). Le `relevantText` est généré depuis `shop_name` (pas de colonne).

## 2. Géocodage — module pur + fetch

Nouveau module `src/lib/geo/geocode.ts` :
- `buildNominatimUrl(address: string): string` (pur) — `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<encodeURIComponent(address)>`.
- `parseGeocode(json: unknown): { latitude: number; longitude: number } | null` (pur) — 1er élément du tableau Nominatim → `{ latitude: Number(lat), longitude: Number(lon) }` ; `null` si tableau vide / champs manquants / non numériques.
- `isValidLatLng(lat: number, lng: number): boolean` (pur) — finis, `lat ∈ [-90,90]`, `lng ∈ [-180,180]`.
- `proximityText(shopName: string): string` (pur) — `À deux pas — votre carte ${shopName}`.
- `geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null>` (fetch) — `fetch(buildNominatimUrl(address), { headers: { "User-Agent": "<app>/1.0 (contact)" } })` → `parseGeocode` ; `null` sur erreur réseau/HTTP. Valide via `isValidLatLng` avant de retourner.

On ne géocode **qu'à l'enregistrement de l'adresse** (opération rare) → conforme à la limite ~1 req/s de Nominatim. User-Agent identifiant l'application (politique d'usage).

## 3. Injection dans les pass

- **Apple** (`src/lib/wallet/passJson.ts`) : ajouter à `PassJsonInput` un champ optionnel
  `locations?: { latitude: number; longitude: number; relevantText: string }[]`.
  Si présent et non vide → positionner le champ **top-level** `pass.locations`.
  `src/lib/applePass.ts` (`buildApplePassBuffer`, qui charge déjà le marchand) lit `latitude`/`longitude` ; si présentes → `locations: [{ latitude, longitude, relevantText: proximityText(shopName) }]` transmis à `buildPassJson`.
- **Google** (`src/lib/googlePass.ts`) : ajouter `locations: [{ latitude, longitude }]` à l'objet fidélité quand les coords du marchand existent.
- `maxDistance` **non fixé** (l'OS décide du rayon).

## 4. Mise à jour des pass existants

Les pass nouvellement générés/ré-émis embarquent les `locations`. Pour les cartes **déjà installées** : à l'enregistrement d'une nouvelle adresse, déclencher un **push de rafraîchissement best-effort** — réutilise `getChannels().notify(cardIds)` (Module 3), **sans message**, sur les cartes du marchand → les appareils retéléchargent le pass (via l'endpoint get-latest, qui régénère avec `locations`). Encapsulé dans un `try/catch` : un échec ne fait pas échouer la sauvegarde de l'adresse.

## 5. UI — deux surfaces (DRY sur le géocodage)

- **Marchand — `/dashboard/settings`** : champ « Adresse de la boutique » + bouton Enregistrer. À la sauvegarde : géocode → stocke `address`/`latitude`/`longitude` → push de rafraîchissement. Affiche « Position trouvée ✓ » ou, en cas d'échec, un message + champs **lat/lng manuels** (validés par `isValidLatLng`).
- **Admin — `/admin/merchants/[id]`** (panneau du sous-projet 1, `EditMerchantForm`) : même champ adresse ; la route `PATCH /api/admin/merchants/[id]` géocode aussi à la sauvegarde.
- **Helper de géocodage partagé** (`src/lib/geo/geocode.ts`) utilisé par les deux chemins de sauvegarde — aucune logique dupliquée.

## 6. Validation & erreurs

- Adresse : trim, longueur 5–200 → sinon `400`.
- Lat/lng manuels (si fournis) : `isValidLatLng` → sinon `400`.
- Géocodage sans résultat → on enregistre l'adresse, `latitude`/`longitude` à `null`, et on informe (« Adresse non localisée — saisis les coordonnées »). Pas de proximité tant que coords absentes.
- Nominatim indisponible/timeout → `geocodeAddress` renvoie `null`, jamais d'erreur `500` ; même message « non localisée ».

## 7. Tests (TDD)

Logique pure :
- `buildNominatimUrl` : encodage des espaces/accents (`q=` correctement encodé).
- `parseGeocode` : tableau valide → coords numériques ; tableau vide → `null` ; champs manquants/non numériques → `null`.
- `isValidLatLng` : bornes (90/-90/91, 180/-180/181), `NaN`/`Infinity` rejetés.
- `proximityText` : contient le nom de boutique.
- `buildPassJson` : `locations` présent quand fourni ; absent sinon.

Routes (admin/marchand), Apple/Google et UI : vérifiés par `npm run build` + fumée (compte démo : saisir une adresse → coords trouvées → pass régénéré contient `locations`).

## Réutilisation / cohérence

Le helper `geo` est partagé entre les deux surfaces de saisie. Le refresh réutilise le canal push du Module 3 et la régénération de pass (Apple/Google) existante. Le champ adresse s'ajoute au panneau de config marchand déjà livré (sous-projet 1) côté admin. Aucune logique dupliquée ; le futur iBeacon (premium) réutilisera la même position de boutique.
