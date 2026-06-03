# Sous-projet 4b — Campagnes self-service (programmées & récurrentes) — Design

**Date :** 2026-06-03
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)
**Contexte :** second volet du Module 4 (Campagnes). Le premier volet — envoi manuel immédiat à une audience ciblée — est livré (sous-projet 4a). Ici on ajoute la **dimension temps** (différé + récurrent), pilotée **par le commerçant lui-même**.

## Objectif

Donner au commerçant un onglet **« Campagnes »** où il **gère lui-même** ses campagnes push Wallet, avec le plein contrôle : il choisit l'audience, rédige le message, et décide du moment (maintenant, un jour donné, ou en continu activable/désactivable). L'admin n'intervient pas dans la création des campagnes (rôle support uniquement). Réutilise le canal push (Module 3), le moteur de segmentation/audiences (Module 2 + 4a) et l'envoi existant (4a) comme **sources uniques** — aucune logique d'audience ni de push dupliquée.

## Décisions validées (brainstorming)

1. **Pas d'automatisation imposée** : rien ne part « tout seul » sans qu'une campagne ait été **créée et activée par le commerçant**.
2. **Trois moments réunis dans un seul écran**, lisible et rapide : `Maintenant` · `Programmée (un jour)` · `Récurrente (ON/OFF)`.
3. **Audiences = celles déjà livrées (4a)** : les 5 segments de cycle de vie + « Récompense prête » + « Tous mes clients » (`AudienceKey`). Pas de nouveau type d'audience, pas de logique d'anniversaire.
4. **Un seul cron quotidien** (plan Vercel hobby = 1×/jour) exécute les campagnes dues/actives de tous les marchands.
5. **Anti-spam récurrent** : cooldown par client (défaut **30 j**) pour ne pas re-notifier en boucle.

## Périmètre

**Inclus** : table `campaigns` + `campaign_sends`, onglet « Campagnes » (liste + création + édition + activation/désactivation + suppression), endpoint CRUD marchand, endpoint cron protégé (`CRON_SECRET`), logique pure d'éligibilité (due/recipients/validation), réutilisation de `fetchAudienceCardIds` et `getChannels()`, tests TDD sur la logique pure.

**Hors périmètre (YAGNI / plus tard)** : email/SMS, heure précise d'envoi (granularité = jour sur hobby), campagne anniversaire d'inscription, modèles de message multiples, A/B testing, analytics de performance dédiées (taux d'ouverture…), combinaisons d'audiences complexes (segment ET étiquette), multi-établissements.

## 1. Modèle de campagne

Une **campagne** = **audience** + **message** + **moment**.

- **Audience** : un `AudienceKey` existant (`@/lib/segments/audience`) — aucun nouveau modèle.
- **Message** : `title` + `body` (mêmes contraintes que 4a, non vides).
- **Moment** (`mode`) :
  - `once` → un champ `run_on` (date). Envoi unique le jour venu.
  - `recurring` → un booléen `active` (ON/OFF) + `cooldown_days` (défaut 30). Tant qu'active, envoie aux membres **actuels** de l'audience non notifiés récemment par cette campagne.
- `Maintenant` n'est **pas** une campagne persistée : c'est l'envoi 4a existant (`POST /api/notifications/send`), inchangé. L'écran de création propose simplement ce mode comme raccourci vers le flux 4a.

## 2. Données (migration légère, créée mais NON appliquée par le sous-agent)

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id   uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  audience      text NOT NULL DEFAULT 'all',
  title         text NOT NULL,
  body          text NOT NULL,
  mode          text NOT NULL CHECK (mode IN ('once','recurring')),
  run_on        date,                      -- requis si mode = 'once'
  active        boolean NOT NULL DEFAULT true,  -- pertinent si mode = 'recurring'
  cooldown_days int  NOT NULL DEFAULT 30,
  last_run_on   date,                       -- dernier passage du cron ayant traité cette campagne
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant ON campaigns (merchant_id);

CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  card_id     text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, card_id, sent_at)
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_lookup ON campaign_sends (campaign_id, card_id, sent_at);
```

RLS : `campaigns` scopée au marchand (policies analogues aux autres tables marchand) ; `campaign_sends` écrite/lue côté serveur via `supabaseAdmin` (comme `wallet_device_registrations`). Migration appliquée en prod (`oqcelbbozpykwkasjtqy`) par le contrôleur **avec consentement**, hors du sous-agent.

## 3. Logique pure (testée, sans DB)

Dans `src/lib/campaigns/` :

- `validateCampaignInput(input)` → `{ ok: true, value } | { ok: false, error }` :
  - `audience` ∈ `AUDIENCE_KEYS` ; `title`/`body` non vides ;
  - `mode` ∈ `{once, recurring}` ; si `once` → `run_on` présent et valide ; si `recurring` → `cooldown_days ≥ 1`.
- `isCampaignDue(campaign, today)` (pour `once`) : vrai si `mode === 'once'` && `run_on ≤ today` && pas encore exécutée (`last_run_on` nul). Détermine si le cron doit l'envoyer aujourd'hui.
- `selectRecurringRecipients(cardIds, lastSentByCard, cooldownDays, now)` : à partir des cartes de l'audience actuelle et d'une map `cardId → dernier sent_at`, garde celles jamais notifiées ou notifiées il y a plus de `cooldownDays`. Renvoie la liste à notifier.

→ Découpage pur/DB identique au reste du repo (testé sur les fonctions, pas sur les `fetch*`).

## 4. Endpoint cron (le seul code « autonome »)

`POST /api/cron/campaigns` (`runtime = "nodejs"`) :

- **Auth** : vérifie l'en-tête `Authorization: Bearer <CRON_SECRET>` (env `CRON_SECRET`). Rejette `401` sinon. Déclaré dans `vercel.json` (`crons: [{ path: "/api/cron/campaigns", schedule: "0 9 * * *" }]`).
- **Job système** (pas de session marchand) → `supabaseAdmin`, boucle sur les campagnes pertinentes de **tous** les marchands :
  - `once` dues (`isCampaignDue`) → résout l'audience (`fetchAudienceCardIds(merchant_id, audience)`), notifie via `getChannels()`, journalise dans `wallet_notifications` (réutilise le flux 4a : `reachable = registrations ∩ cardIds`), insère les `campaign_sends`, met `last_run_on = today`.
  - `recurring` actives → résout l'audience, charge les `campaign_sends` récents (cooldown), `selectRecurringRecipients`, notifie, journalise, insère `campaign_sends`, met `last_run_on = today`.
- Idempotence jour : `last_run_on = today` empêche un double envoi si le cron repasse le même jour ; le cooldown protège le récurrent.
- Best-effort : un échec sur une campagne n'interrompt pas les autres (try/catch par campagne).

## 5. API marchand (CRUD, scopée au marchand)

`/api/campaigns` :
- `GET` → liste des campagnes du marchand connecté (`currentMerchantId()`).
- `POST` → `validateCampaignInput` puis insert (scoping marchand).
- `PATCH /api/campaigns/[id]` → édition / `active` ON-OFF (vérifie l'appartenance au marchand).
- `DELETE /api/campaigns/[id]` → suppression (vérifie l'appartenance au marchand).

Réutilise `currentMerchantId()` et le pattern de scoping des routes existantes. Le mode `Maintenant` n'utilise pas ces routes (il appelle `/api/notifications/send` de 4a).

## 6. UI — nouvel onglet « Campagnes »

- Entrée de nav ajoutée dans `DashboardShell.tsx` (après « Notifications »), icône type `Megaphone`/`Send`.
- **Liste** : chaque campagne avec son audience (libellé via `audienceLabel`), son message, son statut lisible (« Programmée le 7 juin », « Récurrente • active », « Récurrente • en pause »), et les actions (éditer, activer/désactiver, supprimer).
- **Création** (formulaire unique, rapide) : sélecteur d'audience avec tailles (réutilise `/api/segments` comme `SendForm` de 4a) → titre + message → choix du moment (`Maintenant` / `Programmée` + date / `Récurrente` + cooldown par défaut masqué). « Maintenant » poste vers le flux 4a ; « Programmée »/« Récurrente » créent une campagne via `/api/campaigns`.
- Cohérence visuelle avec l'onglet Notifications/Segments existant (Tailwind v4, même grammaire de cartes `bg-zinc-900/40 border border-zinc-800 rounded-2xl`).

## 7. Validation & sécurité

- `CRON_SECRET` obligatoire pour l'endpoint cron ; sans en-tête valide → `401`. Variable à ajouter dans l'env Vercel (Production) par le contrôleur.
- CRUD marchand : `currentMerchantId()` requis (`401` sinon) ; chaque mutation vérifie `merchant_id` (pas d'accès croisé). RLS sur `campaigns`.
- `validateCampaignInput` rejette toute entrée incohérente (`400`).
- Anti-spam : 10 envois/h marchand conservé sur le flux 4a ; cooldown par client sur le récurrent ; `last_run_on` anti double-envoi jour.
- Audiences résolues par marchand (`fetchAudienceCardIds` filtre déjà par `merchant_id`) — aucune fuite inter-marchand.

## 8. Tests (TDD)

Logique pure (`src/lib/campaigns/__tests__/`) :
- `validateCampaignInput` : audience invalide, message vide, `once` sans `run_on`, `recurring` cooldown < 1, cas valides (once & recurring).
- `isCampaignDue` : `run_on` passé/aujourd'hui/futur, déjà exécutée (`last_run_on` non nul), mode `recurring` (toujours non « due » au sens once).
- `selectRecurringRecipients` : carte jamais notifiée (incluse), notifiée hier avec cooldown 30 (exclue), notifiée il y a 31 j (incluse), audience vide (→ `[]`).

Routes + cron + UI : vérifiés par `npm run build` + fumée sur le compte démo (créer une campagne programmée pour aujourd'hui, déclencher le cron en local avec `CRON_SECRET`, voir l'envoi + l'historique ; activer/désactiver une récurrente).

## Réutilisation / cohérence

`fetchAudienceCardIds` (4a) + `getChannels()` (Module 3) + le flux de journalisation `wallet_notifications` (4a) restent les sources uniques : la campagne ne fait qu'ajouter **quand** envoyer et **à qui re-éviter** (cooldown). Le mode `Maintenant` ne duplique rien — il pointe vers l'envoi 4a. Aucun nouveau sous-système d'audience ni de push.
