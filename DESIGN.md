---
name: HALO — HaloCard
description: Digital wallet loyalty cards for Geneva merchants — émeraude-on-onyx, artisan-calm
colors:
  halo-emeraude: "#0D6B5E"
  halo-emeraude-deep: "#0A574C"
  halo-glow: "#1FB89A"
  reward-gold: "#E8B964"
  reward-gold-deep: "#C9952F"
  reward-gold-soft: "#F4D9A0"
  onyx: "#0E0F11"
  onyx-soft: "#16171A"
  onyx-line: "#21232A"
  calcaire: "#F3F0E9"
  surface-white: "#FFFFFF"
  line-warm: "#E6E1D5"
  galet: "#9B9DA0"
  galet-ink: "#6E7073"
  danger: "#E2513A"
  info: "#4FA3E0"
typography:
  display:
    fontFamily: "Fraunces, Canela, Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, Canela, Georgia, serif"
    fontSize: "clamp(1.75rem, 3vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, Söhne, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, Söhne, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, Söhne, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Geist Mono, JetBrains Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  input: "12px"
  control: "16px"
  card: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  "2xl": "64px"
  "3xl": "120px"
components:
  button-primary:
    backgroundColor: "{colors.halo-emeraude}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.halo-emeraude-deep}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
  button-app-primary:
    backgroundColor: "{colors.halo-emeraude}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.input}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.onyx}"
    rounded: "{rounded.input}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.calcaire}"
    textColor: "{colors.onyx}"
    rounded: "{rounded.input}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.onyx}"
    rounded: "{rounded.card}"
    padding: "24px"
  reward-flash:
    backgroundColor: "{colors.reward-gold}"
    textColor: "{colors.onyx}"
    rounded: "{rounded.control}"
    padding: "24px"
---

# Design System: HALO — HaloCard

## 1. Overview

**Creative North Star: "The Lit Counter"**

HALO is the halo of warm light that falls over a well-kept Geneva shop counter. The whole system is built around that scene: an artisan, mid-service, phone in hand, handing a regular their reward. The dark **onyx** ground is the dim of the shop; **émeraude** is the steady, trustworthy glow that signals the brand and every primary action; **gold** is the single warm flare reserved for the moment a customer actually earns something. Nothing else competes for that light.

The personality is **Clair · Élégant · Vibrant** — Swiss-French restraint with a craftsman's warmth. The Fraunces serif carries identity and emotion (italic for emphasis); Inter does the quiet, legible work of running an app. Density is generous: soft radii, comfortable padding, flat surfaces at rest. This is a premium object a proud independent merchant would want on their counter — never a tech demo, never a growth funnel.

This system explicitly rejects four lanes. It is **not a generic SaaS template** (no cream backgrounds, gradient blobs, hero-metric panels, or identical icon-card grids). It is **not loud fintech/crypto** (no neon-on-black, no decorative glassmorphism, no hype). It is **not cold enterprise** (no navy-and-gray soulless dashboards). And it is **not a childish loyalty app** (no mascots, no candy primaries, no badge confetti). Warmth comes from type, copy, and the rationed gold — not from tinting every surface.

**Key Characteristics:**
- Two grounded surface worlds: **onyx-dark** for brand/marketing, **calcaire-light** for the working app.
- Émeraude is the one steady voice; gold is rationed to the reward beat alone.
- Flat by default — depth is conveyed by tonal layering and warm hairlines, not shadow.
- Serif (Fraunces) for identity, sans (Inter) for the workflow; Swiss-French copy throughout.
- Counter-first ergonomics: big, forgiving, unmistakable primary actions.

## 2. Colors

A calm, two-world palette: a deep onyx night and a warm calcaire day, lit by a single émeraude glow and a rationed gold flare.

### Primary
- **Émeraude** (`#0D6B5E`): The brand and the workhorse. Every primary CTA, active state, focus ring, and identity moment. On dark grounds it glows; on light grounds it anchors. This is the only color allowed to mean "act here."
- **Émeraude Deep** (`#0A574C`): The pressed/hover shade for any émeraude surface. Never used as a fill on its own — only as the response to interaction.
- **Halo Glow** (`#1FB89A`): The luminous tip of the émeraude family. Reserved for the holographic card sheen, success ticks, and thin accent glints — the literal "halo." Used at low opacity, never as a large fill.

### Secondary — Reward Gold (rationed)
- **Reward Gold** (`#E8B964`), **Gold Deep** (`#C9952F`), **Gold Soft** (`#F4D9A0`): The warm flare of a customer earning a reward — the full-screen "Offrir la récompense" moment and the reward gradient (`linear-gradient(160deg, #F4D9A0, #E8B964, #C9952F)`). **This is not a brand color.** It appears only at the reward beat. Émeraude stays the identity everywhere else.

### Neutral
- **Onyx** (`#0E0F11`): The dark-world background — marketing/brand surfaces and the digital card itself.
- **Onyx Soft** (`#16171A`): Raised panels and inset wells on dark surfaces.
- **Onyx Line** (`#21232A`): Hairline dividers and borders on dark surfaces.
- **Calcaire** (`#F3F0E9`): The light-world background — the working app, and inset field fills. A warm limestone, not a cream tint; its warmth is structural, carried through the whole light world.
- **Surface White** (`#FFFFFF`): Raised cards and panels sitting on calcaire.
- **Line Warm** (`#E6E1D5`): The signature warm hairline. Borders every card, input, nav, and divider in the light world. The single most-used structural color in the app.
- **Galet** (`#9B9DA0`): Muted text on dark grounds and placeholder text. Large/secondary text only.
- **Galet Ink** (`#6E7073`): The darker galet for muted body text on light grounds, where `#9B9DA0` would fail AA. Use this for secondary copy on calcaire/white.

### System
- **Danger** (`#E2513A`): Errors, destructive confirmation. **Info** (`#4FA3E0`): Neutral notices. Used sparingly; never decoratively.

### Named Rules
**The One Glow Rule.** Émeraude is the only color that signals action. If two things on a screen are émeraude, they are both primary — so there is never more than one per section. Everything else recedes to neutral.

**The Rationed Gold Rule.** Gold is forbidden outside the reward moment. It is not a secondary brand color, not a highlight, not a chart hue. Its rarity is the entire point — it must mean "you earned this" every single time it appears.

## 3. Typography

**Display Font:** Fraunces (with Canela as the premium original, Georgia/serif fallback)
**Body Font:** Inter (with Söhne as the premium original, system-ui fallback)
**Label/Mono Font:** Geist Mono (with JetBrains Mono fallback)

**Character:** A true contrast pairing — Fraunces is a warm, high-contrast "old-style" serif that carries craft and emotion (its optical italic does the emphasis work); Inter is a neutral, hyper-legible grotesque that disappears into the workflow. Serif for who we are, sans for what you're doing.

### Hierarchy
- **Display** (Fraunces, 400, `clamp(2.25rem → 4.5rem)`, line-height 1.05, tracking -0.02em): Hero headlines and brand moments only. `text-wrap: balance`. Italic for the emphasized phrase.
- **Headline** (Fraunces, 400, `clamp(1.75rem → 3rem)`, line-height 1.1): Section titles on marketing and major app page headers (`text-4xl`/`text-5xl`).
- **Title** (Inter, 600, 1.125rem, line-height 1.3): Card titles, dialog headers, list-group labels in the app. Sans, not serif — work surfaces stay quiet.
- **Body** (Inter, 400, 1rem, line-height 1.6): All running copy. Cap measure at 65–75ch; `text-wrap: pretty` on long prose.
- **Label** (Inter, 600, 0.6875rem, tracking 0.14em, uppercase): The émeraude pill badge and small status caps only. A deliberate, branded device — **not** a per-section eyebrow.
- **Mono** (Geist Mono, 400, 0.875rem): Tabular figures, codes, IDs, `tabular-nums` columns in tables.

### Named Rules
**The Serif-Says-Who, Sans-Says-What Rule.** Fraunces is for identity and emotion (heroes, brand headlines). Inter is for the job (titles, body, labels, every form). Never set body copy or UI controls in the serif; never set a hero in the sans.

## 4. Elevation

Flat by default. The system overwhelmingly uses a single soft `shadow-sm` (~80% of all elevated surfaces); depth is carried by **tonal layering** (onyx → onyx-soft, calcaire → surface-white) and the **warm hairline** (`line-warm` / `onyx-line`), not by stacked shadows. Shadows are a quiet ambient lift under a resting card, or a response to state — never a structural device or a 2014-style drop shadow.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)` — Tailwind `shadow-sm`): The default lift for cards and panels in the light world.
- **Soft float** (`box-shadow: 0 8px 30px -12px rgba(14,15,17,0.18)`): For raised moments — featured cards, hover lift, popovers. Wide, diffuse, low-opacity; reads as light, not weight.
- **Dark-world card** (`box-shadow: 0 8px 24px rgba(0,0,0,0.35)`): The digital loyalty card and dark-surface panels sit deeper against onyx; heavier because the ground is darker.

### Named Rules
**The Hairline-First Rule.** Reach for `border: 1px solid` in `line-warm` (light) or `onyx-line` (dark) before reaching for a shadow. If a card needs separation, the warm hairline does it. Shadow is the second resort, not the first.

## 5. Components

Refined and restrained. Soft generous radii, flat fills, quiet states, one émeraude action per region. Buttons and inputs feel calm and trustworthy under the hand — never glossy, never loud.

### Buttons
- **Shape:** Pill (`rounded-full`, 9999px) on marketing CTAs; soft rect (`rounded-xl`, 12px) for in-app controls.
- **Primary (marketing CTA):** Émeraude fill (`#0D6B5E`), white text, `font-semibold`, padding `16px 32px`. Hover → Émeraude Deep (`#0A574C`); `active:scale-95`; focus → `ring-2 ring-halo`, no outline.
- **Primary (in-app):** Émeraude fill, white text, `font-bold`, smaller padding `8px 16px`, `rounded-xl`. `disabled:opacity-50`.
- **Secondary / Ghost:** White (or onyx-soft) fill, `line-warm` 1px border, `text-onyx`, `font-medium`, `rounded-xl`. Hover → fill shifts to `calcaire` or border to `galet`. Used for every "not the one action" — back, cancel, filters.

### Cards / Containers
- **Corner Style:** `rounded-3xl` (24px) for primary cards; `rounded-2xl` (16px) for inset wells and tiles.
- **Background:** `surface-white` on calcaire (light world); `onyx-soft` on onyx (dark world).
- **Border:** Always a 1px `line-warm` (light) / `onyx-line` (dark) hairline — this is the card's primary definition.
- **Shadow Strategy:** `shadow-sm` at rest; Soft float on hover/feature (see Elevation). Never nest a card inside a card.
- **Internal Padding:** `24px` (`p-6`), stepping to `32px` (`p-8`) at `sm` and up.
- **Empty states:** A dashed `line-warm` border (`rounded-2xl border-2 border-dashed`), centered `galet-ink` copy. The one place dashed borders are allowed.

### Inputs / Fields
- **Style:** `calcaire` fill, 1px `line-warm` border, `rounded-xl` (12px), `text-onyx`, padding `8px 12px`. Larger search variant: `rounded-2xl`, `py-3.5`, leading icon.
- **Focus:** Border shifts to émeraude (`focus:border-halo`) with an optional `ring-2 ring-halo/25` glow. No harsh outline.
- **Placeholder:** `galet` — but held to AA; never lighter.

### Navigation
- **App nav:** Sticky top bar, `bg-calcaire/80 backdrop-blur`, 1px `line-warm` bottom border, `z-10`. Desktop sidebar offsets content by `lg:left-72`; mobile uses fixed top + bottom bars with `safe-area-inset` padding.
- **States:** Active link carries émeraude; hover lifts muted `galet-ink` toward `onyx`. Visible focus rings throughout.
- **z-index scale:** sticky nav `z-10` → overlays/backdrops `z-40` → modals & mobile full-screens `z-50`. Keep to this ladder; no arbitrary `999`.

### The Digital Loyalty Card (signature)
The product's hero object: an onyx card on which the merchant's white-label brand sits, finished with the **holographic sheen** (`.halo-holo`, a low-opacity multi-hue gradient at `mix-blend-mode: screen`) and a periodic **light sheen** sweep (`.halo-sheen`). Both are kept subtle and **disable entirely under `prefers-reduced-motion`**. This is the one place spectral color is allowed — and only as a faint, premium shimmer, never a rainbow fill.

## 6. Do's and Don'ts

### Do:
- **Do** keep émeraude (`#0D6B5E`) as the single action color — one primary per section (The One Glow Rule).
- **Do** ration gold (`#E8B964`) to the reward moment only; it is not a brand color (The Rationed Gold Rule).
- **Do** define cards and fields with the warm 1px hairline (`line-warm` / `onyx-line`) before reaching for shadow (The Hairline-First Rule).
- **Do** use `galet-ink` (`#6E7073`), not `galet` (`#9B9DA0`), for muted body text on light grounds — galet fails AA at body size.
- **Do** set identity in Fraunces and the working UI in Inter (The Serif-Says-Who Rule).
- **Do** keep motion 150–300ms, transform/opacity, and ship a `prefers-reduced-motion: reduce` path for every animation — the card sheen disables under it.
- **Do** write copy in Swiss-French (vouvoiement), direct artisan tone, lucide icons only (1.5–2px stroke), no emoji.

### Don't:
- **Don't** ship the **generic SaaS template** — no cream/sand backgrounds, gradient blobs, hero-metric panels, or identical icon-heading-text card grids.
- **Don't** go **loud fintech/crypto** — no neon-on-black, no decorative glassmorphism, no aggressive gradients or hype energy.
- **Don't** go **cold enterprise** — no navy-and-gray dense soulless dashboards; the warmth is non-negotiable.
- **Don't** go **childish loyalty app** — no mascots, candy primaries, or gamified badge confetti.
- **Don't** use a colored `border-left`/`border-right` stripe as an accent; use the full hairline, a tonal fill, or nothing.
- **Don't** use `background-clip: text` gradient text or per-section uppercase eyebrows — the label cap is one deliberate branded device, not section scaffolding.
- **Don't** tint a near-white background warm and call it the brand. The light world is the deliberate `calcaire` (`#F3F0E9`); warmth lives in type and the gold flare, not in default-tinting every surface.
- **Don't** nest a card inside a card, or stack shadows for depth — layer tonally instead.
