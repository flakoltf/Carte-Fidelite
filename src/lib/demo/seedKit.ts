// SEED DU KIT DÉMO (Phase 3) — applique DEMO_KIT à la flotte de prospection.
//
// Pour CHAQUE marchand de l'allowlist : (1) garde stricte assertDemoKitMerchant
// AVANT toute écriture, (2) upload des PNG (rendus par sharp) au bucket
// card-assets sous le préfixe `{merchantId}/…`, (3) publication du design,
// (4) mise à jour identité + programme, (5) clientèle d'exemple à états VARIÉS
// (vide / mi-parcours / reward-ready / juste offerte).
//
// Découpage : fonctions PURES (design, payload marchand, plan de cartes,
// chemins d'assets) testées sans réseau ; orchestrateur à dépendances injectées
// (db / render / upload) — la route admin et le script CLI les câblent.
//
// INVARIANTS : jamais un marchand hors allowlist (throw) · tenancy .eq partout ·
// chemins d'assets scoped au tenant · aucune nouvelle AuditAction.

import type { CardDesign, CardField, LogoAssets } from "@/lib/cardDesign/types";
import { designToPublishRow } from "@/lib/merchant/cardStudio";
import { purgeDemoCustomerData } from "./purge";
import type { DemoDb } from "./db";
import { assertDemoKitMerchant } from "./allowlist";
import { DEMO_KIT, type DemoKitEntry } from "./kit";

const DAY = 86400000;

// ─── Plan d'upload : PNG committé (rendu localement avec polices) → Storage ───
// `src` = fichier versionné dans assets/demo-kit/<slug>/ (rendu par
// scripts/render-demo-assets.mjs) ; `file` = nom dans le bucket ; `field` = clé
// logo_assets. On UPLOAD les PNG committés tels quels (la typographie dessinée
// dépend des polices système → rendue LOCALEMENT, jamais côté serveur).

type AppleField = "x1" | "x2" | "x3" | "icon1" | "icon2" | "icon3" | "strip1" | "strip2" | "strip3";
type GoogleField = "logo" | "hero";

export const APPLE_ASSETS: readonly { src: string; file: string; field: AppleField }[] = [
  { src: "apple-strip@1x.png", file: "strip.png", field: "strip1" },
  { src: "apple-strip@2x.png", file: "strip@2x.png", field: "strip2" },
  { src: "apple-strip@3x.png", file: "strip@3x.png", field: "strip3" },
  { src: "apple-logo@1x.png", file: "logo.png", field: "x1" },
  { src: "apple-logo@2x.png", file: "logo@2x.png", field: "x2" },
  { src: "apple-logo@3x.png", file: "logo@3x.png", field: "x3" },
  { src: "apple-icon@1x.png", file: "icon.png", field: "icon1" },
  { src: "apple-icon@2x.png", file: "icon@2x.png", field: "icon2" },
  { src: "apple-icon@3x.png", file: "icon@3x.png", field: "icon3" },
];

export const GOOGLE_ASSETS: readonly { src: string; file: string; field: GoogleField }[] = [
  { src: "google-logo.png", file: "logo.png", field: "logo" },
  { src: "google-hero.png", file: "hero.png", field: "hero" },
];

export function applePath(merchantId: string, file: string): string {
  return `${merchantId}/apple/${file}`;
}
export function googlePath(merchantId: string, file: string): string {
  return `${merchantId}/google/${file}`;
}

// logo_assets complet (chemins Storage déterministes scoped au tenant).
export function buildKitLogoAssets(merchantId: string): LogoAssets {
  const apple: Record<string, string> = {};
  for (const a of APPLE_ASSETS) apple[a.field] = applePath(merchantId, a.file);
  const google: Record<string, string> = {};
  for (const g of GOOGLE_ASSETS) google[g.field] = googlePath(merchantId, g.file);
  return { apple: apple as LogoAssets["apple"], google: google as LogoAssets["google"] };
}

// ─── Design publié (CardDesign complet « showcase ») ──────────────────────────

// Le label du champ primary selon la mécanique. Le primary est le gros nombre/
// statut qu'Apple pose SUR la zone gauche propre du strip.
function primaryLabel(entry: DemoKitEntry): string {
  switch (entry.loyaltyType) {
    case "amount_points": return "POINTS";
    case "visit_based": return "VISITES";
    case "tiered": return "STATUT";
    case "stamp_card": return "TAMPONS";
  }
}

// « Objectif » d'affichage pour le jeton {points} = "X / objectif".
// Borné à merchants.stamp_goal ∈ [1, 50] (contrainte merchants_stamp_goal_range).
// amount_points utilise un primary STATIQUE (le seuil 200 dépasse la borne) →
// son objectif sert seulement au champ {points} discret du dos.
export function goalForDisplay(entry: DemoKitEntry): number {
  let raw: number;
  switch (entry.loyaltyType) {
    case "stamp_card": raw = entry.loyaltyConfig.goal; break;
    case "visit_based": raw = Math.max(...entry.loyaltyConfig.milestones); break;
    case "tiered": raw = Math.max(...entry.loyaltyConfig.tiers.map((t) => t.at)); break;
    case "amount_points": raw = entry.loyaltyConfig.rewardThreshold; break;
  }
  return Math.max(1, Math.min(50, raw));
}

// Jeu de champs RICHE remplissant les zones natives (cf. carte showcase du site).
// Toujours ≥ 1 champ porteur de {points} → évite le fallback « carte morte » de
// passJson. Récompense/horaires/adresse/avis sont injectés AILLEURS par applyIdentity
// (carte vivante F1) → on NE les duplique PAS ici.
export function kitDesignFields(entry: DemoKitEntry): CardField[] {
  const d = entry.demo;
  // primary : tiered → {palier} ; amount_points → valeur STATIQUE (seuil > 50,
  // le jeton {points}="X/50" serait trompeur) ; stamp/visit → {points}="X/objectif".
  const primary: CardField =
    entry.loyaltyType === "tiered"
      ? { id: "primary", zone: "primary", label: "STATUT", value: "{palier}", order: 2 }
      : entry.loyaltyType === "amount_points"
        ? { id: "primary", zone: "primary", label: "POINTS", value: d.primaryValue ?? "{points}", order: 2 }
        : { id: "primary", zone: "primary", label: primaryLabel(entry), value: "{points}", order: 2 };

  const fields: CardField[] = [
    // UN SEUL champ header (comme la carte showcase du site) : sur un pass Apple,
    // la ligne du haut est PARTAGÉE entre le logo, le nom du programme (logoText)
    // et les headerFields — un 2e champ (« DEPUIS ») faisait s'entrechoquer les
    // textes sur iPhone. L'info vit déjà en auxiliary (« MEMBRE DEPUIS »).
    { id: "h_statut", zone: "header", label: "STATUT", value: d.statut, order: 0 },
    primary,
    { id: "s_prog", zone: "secondary", label: "PROGRESSION", value: d.progression, order: 3 },
    { id: "s_next", zone: "secondary", label: "PROCHAIN PALIER", value: d.nextStep, order: 4 },
    { id: "s_month", zone: "secondary", label: "CE MOIS-CI", value: d.thisMonth, order: 5 },
    { id: "a_since", zone: "auxiliary", label: "MEMBRE DEPUIS", value: d.memberSince, order: 6 },
    { id: "a_visits", zone: "auxiliary", label: "VISITES", value: d.totalVisits, order: 7 },
    { id: "a_last", zone: "auxiliary", label: "DERNIÈRE VISITE", value: d.lastVisit, order: 8 },
    // tiered n'a pas de {points} en primary → on le met en auxiliary (progrès vers le top).
    entry.loyaltyType === "tiered"
      ? { id: "a_prog", zone: "auxiliary", label: "PROGRÈS", value: "{points}", order: 9 }
      : { id: "a_ref", zone: "auxiliary", label: "PARRAINAGES", value: d.referrals, order: 9 },
    { id: "b_member", zone: "back", label: "VOTRE N° DE MEMBRE", value: d.memberId, order: 10 },
    { id: "b_how", zone: "back", label: "COMMENT ÇA MARCHE", value: d.howItWorks, order: 11 },
    { id: "b_cond", zone: "back", label: "CONDITIONS DE LA RÉCOMPENSE", value: d.conditions, order: 12 },
  ];
  // amount_points : primary statique → aucun {points} ailleurs. On en place un au
  // DOS (discret) pour neutraliser le fallback « carte morte » de passJson.
  if (entry.loyaltyType === "amount_points") {
    fields.push({ id: "b_counter", zone: "back", label: "PROGRESSION", value: "{points}", order: 13 });
  }
  return fields;
}

export function buildKitDesign(entry: DemoKitEntry, merchantId: string): CardDesign {
  return {
    colors: { ...entry.design.colors },
    programName: entry.design.programName,
    logo: { assets: buildKitLogoAssets(merchantId) },
    fields: kitDesignFields(entry),
    barcode: { ...entry.design.barcode },
    cardType: entry.design.cardType,
  };
}

// ─── Mise à jour identité + programme du marchand ─────────────────────────────

export function buildKitMerchantUpdate(entry: DemoKitEntry, now: Date): Record<string, unknown> {
  return {
    shop_name: entry.shopName,
    address: entry.address,
    latitude: entry.latitude,
    longitude: entry.longitude,
    phone: entry.phone,
    business_hours: entry.businessHours,
    loyalty_type: entry.loyaltyType,
    loyalty_config: entry.loyaltyConfig,
    reward_label: entry.rewardLabel,
    primary_color: entry.design.colors.background,
    ...(entry.googlePlaceId ? { google_place_id: entry.googlePlaceId } : {}),
    // « Objectif » du jeton {points} = "X / objectif" (par mécanique).
    stamp_goal: goalForDisplay(entry),
    // Marqueurs concierge cohérents (jamais d'état mi-rempli → wizard).
    setup_mode: "concierge",
    managed_by_concierge: true,
    signup_source: "concierge",
    onboarding_completed_at: now.toISOString(),
  };
}

// ─── Clientèle d'exemple à états variés ───────────────────────────────────────

export type DemoKitCardSpec = {
  fullName: string;
  /** Compteur de tampons/visites/paliers (0 pour amount_points). */
  stampsCount: number;
  /** Solde de points (amount_points uniquement ; 0 sinon). */
  pointsBalance: number;
  /** Jours depuis le dernier scan ; null = carte neuve jamais scannée. */
  lastScanDaysAgo: number | null;
  state: "empty" | "mid" | "reward-ready" | "just-offered";
};

// Valeur du compteur qui rend la carte « reward-ready » selon la mécanique.
export function rewardReadyValue(entry: DemoKitEntry): number {
  switch (entry.loyaltyType) {
    case "stamp_card": return entry.loyaltyConfig.goal;
    case "visit_based": return Math.max(...entry.loyaltyConfig.milestones);
    case "tiered": return Math.max(...entry.loyaltyConfig.tiers.map((t) => t.at));
    case "amount_points": return entry.loyaltyConfig.rewardThreshold;
  }
}

function midValue(entry: DemoKitEntry): number {
  switch (entry.loyaltyType) {
    case "stamp_card": return Math.max(1, Math.ceil(entry.loyaltyConfig.goal * 0.6));
    case "visit_based": return entry.loyaltyConfig.milestones[0] + 1;
    case "tiered": {
      const ats = entry.loyaltyConfig.tiers.map((t) => t.at).sort((a, b) => a - b);
      return ats[Math.floor(ats.length / 2)] ?? ats[0];
    }
    case "amount_points": return Math.floor(entry.loyaltyConfig.rewardThreshold * 0.55);
  }
}

// Compteur d'une carte « neuve » (tampon de bienvenue éventuel pour stamp_card).
function emptyValue(entry: DemoKitEntry): number {
  if (entry.loyaltyType === "stamp_card") return entry.loyaltyConfig.welcome_stamps ?? 0;
  return 0;
}

const DEMO_NAMES = [
  "Sophie Meier", "Luca Bianchi", "Anne Dubois", "Marc Rochat",
  "Claire Favre", "Tom Schneider", "Léa Girard", "Paul Hofer",
] as const;

// Place la valeur de compteur dans la bonne colonne selon la mécanique.
// amount_points : le comptoir lit points_balance (la carte affiche un primary
// STATIQUE) ; les autres : stamps_count (lu par le jeton {points}).
function counterToCard(entry: DemoKitEntry, value: number): { stampsCount: number; pointsBalance: number } {
  return entry.loyaltyType === "amount_points"
    ? { stampsCount: 0, pointsBalance: value }
    : { stampsCount: value, pointsBalance: 0 };
}

// 6 cartes déterministes : 1 reward-ready, 1 juste offerte (compteur 0), 2 en
// cours, 1 neuve (bienvenue), 1 basse. Couvre tous les écrans de démo.
export function planKitCards(entry: DemoKitEntry): DemoKitCardSpec[] {
  const reward = rewardReadyValue(entry);
  const mid = midValue(entry);
  const low = entry.loyaltyType === "amount_points" ? Math.max(1, Math.round(reward * 0.15)) : 1;
  const empty = emptyValue(entry);

  const specs: { name: string; value: number; days: number | null; state: DemoKitCardSpec["state"] }[] = [
    { name: DEMO_NAMES[0], value: reward, days: 0, state: "reward-ready" },
    { name: DEMO_NAMES[1], value: 0, days: 0, state: "just-offered" },
    { name: DEMO_NAMES[2], value: mid, days: 1, state: "mid" },
    { name: DEMO_NAMES[3], value: Math.max(low, Math.round(mid * 0.5)), days: 3, state: "mid" },
    { name: DEMO_NAMES[4], value: empty, days: null, state: "empty" },
    { name: DEMO_NAMES[5], value: low, days: 7, state: "mid" },
  ];

  return specs.map((s) => ({
    fullName: s.name,
    ...counterToCard(entry, s.value),
    lastScanDaysAgo: s.days,
    state: s.state,
  }));
}

export function demoKitCustomerEmail(slug: string, index: number): string {
  return `demo-${slug}-client-${index + 1}@example.com`;
}

// ─── Orchestrateur (I/O injecté) ──────────────────────────────────────────────

type DbResult<T = unknown> = { data: T; error: unknown };
interface KitSelectBuilder {
  eq(col: string, val: unknown): KitSelectBuilder;
  maybeSingle(): Promise<DbResult<Record<string, unknown> | null>>;
  single(): Promise<DbResult<{ id: string } | null>>;
}
interface KitTable {
  select(cols?: string): KitSelectBuilder;
  insert(payload: unknown): { select(cols?: string): { single(): Promise<DbResult<{ id: string } | null>> } } & PromiseLike<DbResult>;
  update(payload: unknown): { eq(col: string, val: unknown): Promise<DbResult> };
  upsert(payload: unknown, opts?: { onConflict?: string }): Promise<DbResult>;
}
export interface KitDb {
  from(table: string): KitTable;
}

export interface KitSeedDeps {
  db: KitDb;
  /** Lit un PNG committé d'un marchand (assets/demo-kit/<slug>/<file>). */
  readAsset(slug: string, file: string): Promise<Buffer>;
  /** Upload un PNG au bucket card-assets (chemin déjà scoped au tenant). */
  upload(path: string, body: Buffer): Promise<void>;
  /** Auteur de la publication (merchants/card_designs.updated_by). */
  actorUserId: string;
  now?: Date;
}

export interface KitEntryResult {
  slug: string;
  merchantId: string;
  cards: number;
  assets: number;
}

async function seedKitCustomers(db: KitDb, entry: DemoKitEntry, merchantId: string, now: Date): Promise<number> {
  const specs = planKitCards(entry);
  let made = 0;
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const { data: customer } = await db
      .from("customers")
      .insert({ merchant_id: merchantId, full_name: spec.fullName, email: demoKitCustomerEmail(entry.slug, i) })
      .select("id")
      .single();
    if (!customer) continue;

    const lastScan = spec.lastScanDaysAgo == null ? null : new Date(now.getTime() - spec.lastScanDaysAgo * DAY).toISOString();
    const { data: card } = await db
      .from("loyalty_cards")
      .insert({
        merchant_id: merchantId,
        customer_id: customer.id,
        stamps_count: spec.stampsCount,
        points_balance: spec.pointsBalance,
        last_scan: lastScan,
      })
      .select("id")
      .single();
    if (!card) continue;
    made++;

    // Historique de scan seulement si la carte a réellement été scannée.
    const counted = spec.stampsCount + spec.pointsBalance;
    if (lastScan && counted > 0) {
      await db.from("scan_history").insert({
        merchant_id: merchantId,
        card_id: card.id,
        points_added: entry.loyaltyType === "amount_points" ? counted : 1,
        scanned_at: lastScan,
      });
    }
  }
  return made;
}

// Applique UNE entrée du kit (garde + assets + design + programme + clients).
export async function applyKitEntry(deps: KitSeedDeps, entry: DemoKitEntry): Promise<KitEntryResult> {
  const now = deps.now ?? new Date();
  const { db } = deps;

  // 1. Résolution par slug + GARDE STRICTE avant toute écriture.
  const { data: merchant } = await db
    .from("merchants")
    .select("id, slug, email, role")
    .eq("slug", entry.slug)
    .maybeSingle();
  assertDemoKitMerchant(merchant);
  const merchantId = String((merchant as Record<string, unknown>).id);
  // Défense supplémentaire : la ligne doit être PRÉCISÉMENT ce marchand du kit.
  if ((merchant as Record<string, unknown>).email !== entry.email) {
    throw new Error(`Garde kit : email résolu ≠ email du kit pour ${entry.slug}`);
  }

  // 2. Upload des PNG committés (rendus localement avec polices) sous le préfixe
  //    Storage scoped au tenant. Aucun rendu côté serveur (typographie fiable).
  let assets = 0;
  for (const a of APPLE_ASSETS) {
    await deps.upload(applePath(merchantId, a.file), await deps.readAsset(entry.slug, a.src));
    assets++;
  }
  for (const g of GOOGLE_ASSETS) {
    await deps.upload(googlePath(merchantId, g.file), await deps.readAsset(entry.slug, g.src));
    assets++;
  }

  // 3. Publication du design (version incrémentée).
  const { data: current } = await db.from("card_designs").select("version").eq("merchant_id", merchantId).maybeSingle();
  const nextVersion = (Number((current as Record<string, unknown> | null)?.version) || 0) + 1;
  const design = buildKitDesign(entry, merchantId);
  const { error: designErr } = await db
    .from("card_designs")
    .upsert(designToPublishRow(design, merchantId, deps.actorUserId, nextVersion), { onConflict: "merchant_id" });
  if (designErr) throw new Error(`card_designs upsert ${entry.slug}: ${String(designErr)}`);

  // 4. Identité + programme (tenancy .eq("id")).
  const { error: updErr } = await db.from("merchants").update(buildKitMerchantUpdate(entry, now)).eq("id", merchantId);
  if (updErr) throw new Error(`merchants update ${entry.slug}: ${String(updErr)}`);

  // 5. Repart de clients propres (purge scoped au marchand) puis re-sème.
  await purgeDemoCustomerData(db as unknown as DemoDb, merchantId);
  const cards = await seedKitCustomers(db, entry, merchantId, now);

  return { slug: entry.slug, merchantId, cards, assets };
}

// Applique TOUT le kit (séquentiel — petites écritures idempotentes).
export async function seedDemoKit(deps: KitSeedDeps): Promise<KitEntryResult[]> {
  const out: KitEntryResult[] = [];
  for (const entry of DEMO_KIT) out.push(await applyKitEntry(deps, entry));
  return out;
}
