# Spec validée — Cartes à points + variable {visites}

> Validée par le user le 2026-08-26 (4 décisions d'architecture confirmées).

## Produit

HaloCard : compléter la logique des cartes à points du dashboard commerçant et
ajouter la variable dynamique `{visites}` au Card Design Studio.

## Décisions validées

1. **Nouveau `loyalty_type = 'points'`** (points FIXES par scan, paliers multiples).
   `amount_points` (points par CHF, bêta admin) reste intact et séparé.
2. **Paliers en JSONB** dans `merchants.loyalty_config` (pattern existant
   visit_based/tiered), PAS de table `point_tiers`.
3. **Paliers cumulatifs (modèle McDonald's)** : 30 pts → offre A, 40 → offre B…
   Un palier intermédiaire est validable UNE fois par cycle (`redeemed_tiers`),
   les points continuent de s'accumuler ; seule la validation du palier MAX
   remet tout à zéro (points + redeemed_tiers + ancre de cycle).
4. **Expiration « date fixe » = reset annuel récurrent** (ex. chaque 31/12),
   jamais une date unique. « Glissante » = N mois après le premier scan du cycle.
5. **Plafonnement au palier max** : les scans au-delà ne créditent plus
   (statut `full`, comme les tampons) ; pas de reset silencieux au scan — le
   reset ne se produit qu'à la validation staff.

## Exigences fonctionnelles

- **Points par scan** : entier fixe configurable par le marchand (pas de prorata montant).
- **Paliers** : liste configurable {seuil, description libre}, strictement
  croissants, 1 à 6 paliers, le dernier = maximum.
- **Validation staff** : au scan, si palier(s) atteint(s) non validé(s), le
  comptoir affiche une option de validation (jamais d'auto-application).
  Tracée dans audit_logs (`REWARD_REDEEMED` + details).
- **Expiration par carte-programme** : none / fixed_date (annuel récurrent) /
  rolling (N mois après premier scan du cycle). Niveau carte entière. Exécutée
  par un cron quotidien (pattern `/api/cron/*` existant).
- **Notification wallet** au franchissement de palier (infra `getChannels().notify`
  existante) — nécessite le fix du `changeMessage` perdu sur le chemin design.
- **`{visites}`** : COUNT(scan_history) par card_id, résolu comme `{nom}`/`{points}`
  côté serveur Apple, listé dans le Studio + previews. Compteur À VIE (ne reset
  pas avec les points). Limitation Google conservée (classe par marchand, jetons
  non résolus — comportement identique aux jetons existants).

## Contraintes

- RLS/tenancy : toute écriture via routes server-side `supabaseAdmin` + filtre
  `.eq("merchant_id", …)` (invariant 3). Aucune nouvelle table → pas de
  changement au registre RLS.
- UX scan inchangée : un scan = une action ; la validation de récompense est
  une étape additionnelle affichée seulement si palier atteint.
- Migrations 100 % additives/idempotentes, appliquées en prod manuellement avec
  accord explicite du user. Pré-requis prod : `20260618_amount_points.sql`
  (points_balance) — la nouvelle migration ré-ajoute la colonne défensivement
  (`IF NOT EXISTS`) pour lever le risque d'ordre.

## Hors périmètre (explicite)

- Onboarding wizard (le type points se configure au Studio).
- Formulaire admin `EditMerchantForm` (amount_points y reste ; ajout de
  `points` = suivi ultérieur).
- Mise à jour de l'objet Google Wallet au scan (GoogleChannel est un stub gaté
  par `GOOGLE_PUSH_ENABLED` — inchangé).
- Revert (`/api/scan/revert`) pour les points : hors périmètre, le comptoir
  points n'affiche pas d'annulation (noté comme suivi).
