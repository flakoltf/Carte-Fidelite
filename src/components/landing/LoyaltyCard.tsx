import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Scissors,
  Coffee,
  UtensilsCrossed,
  Croissant,
  ShoppingBag,
  Dumbbell,
  Flower2,
  Pizza,
  Sparkles,
  Car,
  Info,
} from "lucide-react";
import QRCode from "react-qr-code";

/**
 * Carte de fidélité d'exemple pour le site vitrine.
 *
 * Objectif : montrer EXACTEMENT ce que le client obtiendra dans son wallet.
 * On reproduit donc l'anatomie réelle d'un pass (cf. les aperçus admin
 * ApplePassPreview / GooglePassPreview) : en-tête logo + nom, champs
 * label/valeur, et code-barres. Aucun effet non reproductible en wallet
 * (pas d'holographie, pas de liseré néon, pas de barre de progression live).
 *
 * Les mécaniques sont rendues de façon réalisable :
 *  - tampons  → rangée d'icônes (équivalent d'une « strip image » générée)
 *  - points   → grand champ + champ objectif
 *  - palier   → pastille de niveau + champ « prochain palier »
 *  - cashback → grand champ montant + champ taux
 *  - pass     → grand champ compteur
 */

type Wallet = "apple" | "google";

type Mechanic =
  | { kind: "stamps"; total: number; filled: number; label: string }
  | { kind: "points"; current: string; target: string; unit: string }
  | { kind: "tier"; badge: string; next: string }
  | { kind: "cashback"; balance: string; rate: string }
  | { kind: "pass"; n: string; label: string };

/**
 * Style de bannière. C'est l'unique surface « image » d'un vrai pass de
 * fidélité : strip image (Apple) / hero image (Google). Soit on fournit une
 * vraie image (`src`), soit on génère un visuel vectoriel dégradé (ci-dessous).
 */
type BannerStyle = "mesh" | "rays" | "dots" | "stripes" | "waves";

type ShowcaseField = { label: string; value: string };

/**
 * Mode « démonstration de capacités » : remplit TOUS les champs qu'un vrai pass
 * sait afficher (en-tête, principal, secondaires, auxiliaires, infos au dos,
 * texte sous le code-barres). Utilisé sur 1–2 cartes pour montrer l'éventail.
 */
type Showcase = {
  /** Champ d'en-tête (haut-droite). Apple : 3 max · Google : compte. */
  headerField: ShowcaseField;
  /** Champ principal (le grand chiffre). */
  primary: ShowcaseField;
  /** Champs secondaires (Apple : 4 max). */
  secondary: ShowcaseField[];
  /** Champs auxiliaires (Apple : 4 max). */
  auxiliary: ShowcaseField[];
  /** Identifiant membre, affiché en texte sous le code-barres (altText). */
  memberId: string;
  /** Nombre d'infos au dos du pass (Apple : recto/verso). */
  backCount: number;
};

export type CardData = {
  name: string;
  type: string;
  Icon: LucideIcon;
  wallet: Wallet;
  /** Apple : fond du pass. Google : couleur du bandeau d'en-tête. */
  bg: string;
  /** Couleur du texte sur le fond (Apple) ou sur le bandeau (Google). */
  fg: string;
  /** Couleur des libellés discrets (Apple uniquement). */
  label: string;
  /** Couleur d'accent : tampons remplis, valeur principale (Google). */
  accent: string;
  /**
   * Bannière (strip Apple / hero Google). `src` = vraie image (JPG/PNG/SVG) ;
   * sinon `style` génère un visuel vectoriel à partir des couleurs de la carte.
   */
  banner?: { style?: BannerStyle; src?: string };
  /** Présent → carte « complète » (tous les champs). Sinon mécanique simple. */
  showcase?: Showcase;
  mechanic: Mechanic;
  reward: string;
};

// ─── Rangée de tampons (équivalent strip image) ────────────────────────────────

function StampRow({
  total,
  filled,
  fill,
  emptyColor,
}: {
  total: number;
  filled: number;
  fill: string;
  emptyColor: string;
}) {
  return (
    <div className="flex flex-wrap gap-[5px]" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[18px] w-[18px] rounded-full"
          style={
            i < filled
              ? { background: fill }
              : { border: `1.5px solid ${emptyColor}`, opacity: 0.55 }
          }
        />
      ))}
    </div>
  );
}

// ─── Petits primitifs de champ ─────────────────────────────────────────────────

function FieldLabel({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div className="text-[9px] font-medium uppercase tracking-[0.1em]" style={{ color }}>
      {children}
    </div>
  );
}

/** Une colonne libellé + valeur (champ secondaire / auxiliaire). */
function FieldCol({
  field,
  labelColor,
  valueColor,
}: {
  field: ShowcaseField;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <div>
      <FieldLabel color={labelColor}>{field.label}</FieldLabel>
      <p className="mt-0.5 text-[12px] font-medium" style={{ color: valueColor }}>
        {field.value}
      </p>
    </div>
  );
}

// ─── Bannière (strip Apple / hero Google) ──────────────────────────────────────

const BANNER_HEIGHT = 76;

/** Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur hex. */
function shade(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const n = parseInt(full, 16);
  const target = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (channel: number) => Math.round((target - channel) * p) + channel;
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return "#" + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Génère un visuel de bannière vectoriel (data URI) à partir des couleurs. */
function bannerDataUri(style: BannerStyle, base: string, accent: string): string {
  const deep = shade(base, -0.42);
  const light = shade(accent, 0.5);
  const defs =
    `<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${base}'/><stop offset='1' stop-color='${deep}'/></linearGradient>` +
    `<filter id='b' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='26'/></filter>` +
    `<pattern id='dot' width='22' height='22' patternUnits='userSpaceOnUse'><circle cx='5' cy='5' r='2.2' fill='#ffffff' opacity='0.16'/></pattern>` +
    `<pattern id='str' width='28' height='28' patternUnits='userSpaceOnUse' patternTransform='rotate(35)'><rect width='14' height='28' fill='#ffffff' opacity='0.08'/></pattern>`;

  let body: string;
  switch (style) {
    case "rays":
      body =
        `<g fill='#ffffff'><polygon points='0,0 210,0 70,120' opacity='0.10'/>` +
        `<polygon points='0,0 120,0 0,120' opacity='0.07'/>` +
        `<polygon points='150,0 300,0 120,120' opacity='0.06'/></g>` +
        `<g filter='url(#b)'><ellipse cx='40' cy='-6' rx='72' ry='62' fill='${light}' opacity='0.5'/></g>`;
      break;
    case "dots":
      body =
        `<rect width='400' height='120' fill='url(#dot)'/>` +
        `<g filter='url(#b)'><ellipse cx='340' cy='18' rx='95' ry='72' fill='${accent}' opacity='0.45'/></g>`;
      break;
    case "stripes":
      body =
        `<rect width='400' height='120' fill='url(#str)'/>` +
        `<g filter='url(#b)'><ellipse cx='60' cy='105' rx='95' ry='72' fill='${light}' opacity='0.4'/></g>`;
      break;
    case "waves":
      body =
        `<path d='M0,78 C110,40 300,120 400,66 L400,120 L0,120 Z' fill='${accent}' opacity='0.5'/>` +
        `<path d='M0,95 C120,58 280,128 400,88 L400,120 L0,120 Z' fill='#ffffff' opacity='0.14'/>`;
      break;
    case "mesh":
    default:
      body =
        `<g filter='url(#b)'><ellipse cx='70' cy='30' rx='95' ry='72' fill='${accent}' opacity='0.6'/>` +
        `<ellipse cx='330' cy='95' rx='120' ry='85' fill='${light}' opacity='0.5'/>` +
        `<ellipse cx='210' cy='4' rx='70' ry='60' fill='#ffffff' opacity='0.18'/></g>`;
  }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 120' preserveAspectRatio='xMidYMid slice'>` +
    `<defs>${defs}</defs><rect width='400' height='120' fill='url(#g)'/>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function Banner({ card, className = "" }: { card: CardData; className?: string }) {
  const src = card.banner?.src;
  // Apple : la base du dégradé est l'accent (visible sur fond sombre).
  // Google : la base est la couleur du bandeau (le hero est posé sur du blanc).
  const base = card.wallet === "google" ? card.bg : card.accent;
  const image = src ? `url("${src}")` : bannerDataUri(card.banner?.style ?? "mesh", base, card.accent);
  return (
    <div
      className={`w-full ${className}`}
      style={{
        height: BANNER_HEIGHT,
        backgroundImage: image,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden
    />
  );
}

// ─── Carte Apple Wallet ────────────────────────────────────────────────────────

function AppleCard({ card }: { card: CardData }) {
  const { name, type, Icon, bg, fg, label, accent, mechanic, reward, showcase } = card;
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[18px] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/5"
      style={{ background: bg, color: fg }}
    >
      {/* En-tête : logo + nom + champ d'en-tête + indicateur iOS */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]"
            style={{ background: accent }}
          >
            <Icon className="h-4 w-4" style={{ color: bg }} strokeWidth={2.25} aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">{name}</p>
            <p className="text-[9px] uppercase tracking-[0.12em]" style={{ color: label }}>
              {type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {showcase && (
            <div className="text-right leading-none">
              <FieldLabel color={label}>{showcase.headerField.label}</FieldLabel>
              <p className="mt-0.5 text-[12px] font-semibold">{showcase.headerField.value}</p>
            </div>
          )}
          <span className="text-[11px]" style={{ color: label }} aria-hidden>
            ●●●
          </span>
        </div>
      </div>

      {/* Strip image (bannière pleine largeur) */}
      {card.banner && <Banner card={card} className="mt-3" />}

      {/* Corps : tous les champs (showcase) ou mécanique simple */}
      <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4 pt-3.5">
        {showcase ? (
          <>
            <div>
              <FieldLabel color={label}>{showcase.primary.label}</FieldLabel>
              <p className="mt-0.5 text-[30px] font-light leading-none">{showcase.primary.value}</p>
            </div>
            {showcase.secondary.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {showcase.secondary.map((f) => (
                  <FieldCol key={f.label} field={f} labelColor={label} valueColor={fg} />
                ))}
              </div>
            )}
            {showcase.auxiliary.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {showcase.auxiliary.map((f) => (
                  <FieldCol key={f.label} field={f} labelColor={label} valueColor={fg} />
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center gap-1.5 text-[10px]" style={{ color: label }}>
              <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {showcase.backCount} infos au dos · appuyez sur ⓘ
            </div>
          </>
        ) : (
          <>
            <AppleMechanic m={mechanic} fg={fg} label={label} accent={accent} bg={bg} />
            <div className="mt-auto">
              <FieldLabel color={label}>Récompense</FieldLabel>
              <p className="mt-0.5 text-[12px] leading-snug">{reward}</p>
            </div>
          </>
        )}
      </div>

      {/* Code-barres + texte alternatif (toujours présent sur un vrai pass) */}
      <div className="bg-white px-4 pb-4 pt-3">
        <div className="mx-auto w-fit rounded-md bg-white">
          <QRCode value={`https://halo.ch/demo/${slug(name)}`} size={58} bgColor="#FFFFFF" fgColor="#0E0F11" />
        </div>
        <p className="mt-1.5 text-center text-[8px] uppercase tracking-[0.22em] text-neutral-400">
          {showcase ? showcase.memberId : "Démo · HALO"}
        </p>
      </div>
    </div>
  );
}

function AppleMechanic({
  m,
  fg,
  label,
  accent,
  bg,
}: {
  m: Mechanic;
  fg: string;
  label: string;
  accent: string;
  bg: string;
}) {
  if (m.kind === "stamps") {
    return (
      <div>
        <FieldLabel color={label}>Tampons</FieldLabel>
        <div className="mt-2">
          <StampRow total={m.total} filled={m.filled} fill={accent} emptyColor={fg} />
        </div>
        <p className="mt-2 text-[11px]" style={{ color: label }}>
          {m.label}
        </p>
      </div>
    );
  }
  if (m.kind === "points") {
    return (
      <div className="flex items-end gap-6">
        <div>
          <FieldLabel color={label}>Solde</FieldLabel>
          <p className="mt-0.5 text-[30px] font-light leading-none">
            {m.current}
            <span className="ml-1.5 text-[10px] uppercase tracking-[0.16em]" style={{ color: label }}>
              {m.unit}
            </span>
          </p>
        </div>
        <div>
          <FieldLabel color={label}>Objectif</FieldLabel>
          <p className="mt-0.5 text-[13px]">{m.target}</p>
        </div>
      </div>
    );
  }
  if (m.kind === "tier") {
    return (
      <div>
        <FieldLabel color={label}>Niveau</FieldLabel>
        <span
          className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: accent, color: bg }}
        >
          ◆ {m.badge}
        </span>
        <p className="mt-2 text-[11px]" style={{ color: label }}>
          {m.next}
        </p>
      </div>
    );
  }
  if (m.kind === "cashback") {
    return (
      <div className="flex items-end gap-6">
        <div>
          <FieldLabel color={label}>Cagnotte</FieldLabel>
          <p className="mt-0.5 text-[30px] font-light leading-none">CHF {m.balance}</p>
        </div>
        <div>
          <FieldLabel color={label}>Taux</FieldLabel>
          <p className="mt-0.5 text-[13px]">{m.rate}</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <FieldLabel color={label}>{m.label}</FieldLabel>
      <p className="mt-0.5 text-[30px] font-light leading-none">{m.n}</p>
    </div>
  );
}

// ─── Carte Google Wallet ───────────────────────────────────────────────────────

function GoogleCard({ card }: { card: CardData }) {
  const { name, type, Icon, bg, fg, mechanic, reward, showcase } = card;
  const bodyLabel = "#777";
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] bg-white text-[#1a1a1a] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
      {/* Bandeau coloré : logo rond + nom + compte */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-3" style={{ background: bg, color: fg }}>
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white"
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" style={{ color: bg }} strokeWidth={2.25} />
          </span>
          <div className="leading-tight">
            <p className="text-[10px]" style={{ opacity: 0.85 }}>
              {type}
            </p>
            <p className="text-[14px] font-semibold">{name}</p>
          </div>
        </div>
        {showcase && (
          <div className="text-right leading-tight">
            <p className="text-[8px] uppercase tracking-[0.1em]" style={{ opacity: 0.8 }}>
              {showcase.headerField.label}
            </p>
            <p className="text-[12px] font-semibold">{showcase.headerField.value}</p>
          </div>
        )}
      </div>

      {/* Hero image (bannière pleine largeur) */}
      {card.banner && <Banner card={card} />}

      {/* Corps blanc : tous les champs (showcase) ou mécanique simple */}
      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
        {showcase ? (
          <>
            <div>
              <FieldLabel color={bodyLabel}>{showcase.primary.label}</FieldLabel>
              <p className="text-[26px] font-medium leading-tight" style={{ color: bg }}>
                {showcase.primary.value}
              </p>
            </div>
            {showcase.secondary.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {showcase.secondary.map((f) => (
                  <FieldCol key={f.label} field={f} labelColor={bodyLabel} valueColor="#1a1a1a" />
                ))}
              </div>
            )}
            {showcase.auxiliary.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {showcase.auxiliary.map((f) => (
                  <FieldCol key={f.label} field={f} labelColor={bodyLabel} valueColor="#1a1a1a" />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <GoogleMechanic m={mechanic} accent={bg} labelColor={bodyLabel} />
            <div className="mt-auto">
              <FieldLabel color={bodyLabel}>Récompense</FieldLabel>
              <p className="mt-0.5 text-[12px] leading-snug text-[#1a1a1a]">{reward}</p>
            </div>
          </>
        )}

        {/* Code-barres + texte alternatif */}
        <div className="mt-1 flex flex-col items-center">
          <QRCode value={`https://halo.ch/demo/${slug(name)}`} size={58} bgColor="#FFFFFF" fgColor="#0E0F11" />
          <p className="mt-1.5 text-[8px] uppercase tracking-[0.22em] text-neutral-400">
            {showcase ? showcase.memberId : "Démo · HALO"}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMechanic({
  m,
  accent,
  labelColor,
}: {
  m: Mechanic;
  accent: string;
  labelColor: string;
}) {
  if (m.kind === "stamps") {
    return (
      <div>
        <FieldLabel color={labelColor}>Tampons</FieldLabel>
        <div className="mt-2">
          <StampRow total={m.total} filled={m.filled} fill={accent} emptyColor="#C7C7C7" />
        </div>
        <p className="mt-2 text-[11px]" style={{ color: labelColor }}>
          {m.label}
        </p>
      </div>
    );
  }
  if (m.kind === "points") {
    return (
      <div>
        <FieldLabel color={labelColor}>Solde</FieldLabel>
        <p className="text-[26px] font-medium leading-tight" style={{ color: accent }}>
          {m.current}
          <span className="ml-1.5 text-[11px] uppercase tracking-[0.12em]" style={{ color: labelColor }}>
            {m.unit}
          </span>
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: labelColor }}>
          Objectif {m.target} {m.unit}
        </p>
      </div>
    );
  }
  if (m.kind === "tier") {
    return (
      <div>
        <FieldLabel color={labelColor}>Niveau</FieldLabel>
        <span
          className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
          style={{ background: accent }}
        >
          ◆ {m.badge}
        </span>
        <p className="mt-2 text-[11px]" style={{ color: labelColor }}>
          {m.next}
        </p>
      </div>
    );
  }
  if (m.kind === "cashback") {
    return (
      <div>
        <FieldLabel color={labelColor}>Cagnotte</FieldLabel>
        <p className="text-[26px] font-medium leading-tight" style={{ color: accent }}>
          CHF {m.balance}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: labelColor }}>
          {m.rate}
        </p>
      </div>
    );
  }
  return (
    <div>
      <FieldLabel color={labelColor}>{m.label}</FieldLabel>
      <p className="text-[26px] font-medium leading-tight" style={{ color: accent }}>
        {m.n}
      </p>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

// ─── Composant public ──────────────────────────────────────────────────────────

export function LoyaltyCard({ card }: { card: CardData; delay?: number }) {
  return card.wallet === "google" ? <GoogleCard card={card} /> : <AppleCard card={card} />;
}

// ─── Données d'exemple (cartes de démonstration) ───────────────────────────────
// Aucun commerçant réel : noms génériques « … Démo », wallet alterné Apple/Google.

export const SAMPLE_CARDS: CardData[] = [
  {
    name: "Café Démo", type: "Café · Coffee shop", Icon: Coffee, wallet: "apple",
    bg: "#241811", fg: "#F6EEE2", label: "#C9A877", accent: "#D8A567",
    banner: { src: "/pass-assets/banners/cafe.jpg" },
    showcase: {
      headerField: { label: "Statut", value: "Or" },
      primary: { label: "Solde fidélité", value: "1 240 pts" },
      secondary: [
        { label: "Niveau", value: "Or" },
        { label: "Prochain palier", value: "260 pts" },
        { label: "Cafés ce mois", value: "14" },
      ],
      auxiliary: [
        { label: "Membre depuis", value: "Mars 2024" },
        { label: "Visites", value: "87" },
        { label: "Parrainages", value: "3" },
      ],
      memberId: "Membre · 4827 6391",
      backCount: 4,
    },
    mechanic: { kind: "stamps", total: 9, filled: 6, label: "6 / 9 cafés" },
    reward: "Le 9ᵉ café offert.",
  },
  {
    name: "Salon Démo", type: "Coiffeur", Icon: Scissors, wallet: "google",
    bg: "#7A5C3A", fg: "#FFFFFF", label: "#E6D6BC", accent: "#7A5C3A",
    banner: { style: "rays" },
    mechanic: { kind: "stamps", total: 10, filled: 7, label: "7 / 10 coupes" },
    reward: "La 10ᵉ coupe offerte.",
  },
  {
    name: "Resto Démo", type: "Restaurant", Icon: UtensilsCrossed, wallet: "apple",
    bg: "#2A1012", fg: "#F7ECE6", label: "#E0A38C", accent: "#E0734F",
    banner: { style: "waves" },
    mechanic: { kind: "points", current: "1 240", target: "1 500", unit: "pts" },
    reward: "À 1 500 pts → −20 CHF.",
  },
  {
    name: "Boulangerie Démo", type: "Boulangerie", Icon: Croissant, wallet: "google",
    bg: "#9A6A1C", fg: "#FFFFFF", label: "#F0DCB4", accent: "#9A6A1C",
    banner: { style: "dots" },
    mechanic: { kind: "stamps", total: 8, filled: 4, label: "4 / 8 achats" },
    reward: "La 8ᵉ viennoiserie offerte.",
  },
  {
    name: "Boutique Démo", type: "Boutique mode", Icon: ShoppingBag, wallet: "apple",
    bg: "#141416", fg: "#F3F0E9", label: "#B9BDC2", accent: "#C7CBD0",
    banner: { style: "stripes" },
    mechanic: { kind: "tier", badge: "Argent", next: "Plus que 1 achat → niveau Or" },
    reward: "Niveau Or → −15% permanents.",
  },
  {
    name: "Gym Démo", type: "Salle de sport", Icon: Dumbbell, wallet: "google",
    bg: "#2F6B1E", fg: "#FFFFFF", label: "#CDE8BE", accent: "#2F6B1E",
    banner: { style: "rays" },
    mechanic: { kind: "pass", n: "12", label: "Séances ce mois-ci" },
    reward: "15 séances → 1 coaching offert.",
  },
  {
    name: "Spa Démo", type: "Institut de beauté", Icon: Sparkles, wallet: "apple",
    bg: "#2A1F27", fg: "#F8ECF1", label: "#E0A6BE", accent: "#E0A6BE",
    banner: { style: "mesh" },
    mechanic: { kind: "cashback", balance: "24.50", rate: "5% rendu sur chaque soin" },
    reward: "Cagnotte utilisable dès 20 CHF.",
  },
  {
    name: "Lavage Démo", type: "Lavage auto", Icon: Car, wallet: "google",
    bg: "#1E6FB0", fg: "#FFFFFF", label: "#C3E0F4", accent: "#1E6FB0",
    banner: { style: "waves" },
    mechanic: { kind: "stamps", total: 5, filled: 4, label: "4 / 5 lavages" },
    reward: "Le 5ᵉ lavage offert.",
  },
  {
    name: "Fleuriste Démo", type: "Fleuriste", Icon: Flower2, wallet: "apple",
    bg: "#122019", fg: "#ECF6EF", label: "#8FD3AE", accent: "#6FC79A",
    banner: { style: "dots" },
    mechanic: { kind: "points", current: "340", target: "500", unit: "pts" },
    reward: "À 500 pts → un bouquet offert.",
  },
  {
    name: "Pizzeria Démo", type: "Pizzeria", Icon: Pizza, wallet: "google",
    bg: "#B5341F", fg: "#FFFFFF", label: "#F2C4BA", accent: "#B5341F",
    banner: { src: "/pass-assets/banners/pizza.jpg" },
    showcase: {
      headerField: { label: "Compte", value: "Marco R." },
      primary: { label: "Points", value: "320 pts" },
      secondary: [
        { label: "Palier", value: "Argent" },
        { label: "Récompense", value: "1 pizza offerte" },
        { label: "Commandes", value: "23" },
      ],
      auxiliary: [
        { label: "Membre depuis", value: "Janv. 2025" },
        { label: "Dernière visite", value: "il y a 4 j" },
      ],
      memberId: "ID · PZ-558210",
      backCount: 3,
    },
    mechanic: { kind: "stamps", total: 6, filled: 3, label: "3 / 6 pizzas" },
    reward: "La 6ᵉ pizza offerte.",
  },
];
