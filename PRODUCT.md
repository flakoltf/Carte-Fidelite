# Product

## Register

product

> Split surface — both kept first-class. Default register is **product** (the
> merchant app: dashboard, scan-at-counter, admin/concierge). The public B2B
> **marketing landing** (`src/app/(marketing)/*`) is an equal-weight **brand**
> surface; target it with `brand` register per-task when working there.

## Users

Two primary audiences, plus the end customer who never installs anything:

- **Small Geneva merchants** (cafés, salons, artisans, indie retail) — the
  dashboard user. Non-technical, time-poor, working at or near the counter.
  Wants to see their loyalty program working without learning software. Uses
  the **scan flow** mid-service, phone in hand, often one-handed and rushed.
- **The concierge admin** (the founder) — creates merchant accounts (public
  signup is disabled: `/signup` → `/login`), manages the fleet, impersonates
  for support. Power-user surface, but audited and high-stakes.
- **End customers** — receive an Apple/Google Wallet loyalty card via a public
  enrollment link (`/c/[slug]`). No app, no account. Their only HALO surface is
  the wallet pass and the enrollment page; it must feel effortless and trusted.

## Product Purpose

HALO (product: **HaloCard**) is a Geneva-based **B2B SaaS for digital loyalty
cards** — Apple Wallet / Google Wallet punch-cards for small merchants, sold on
a concierge model. Plans are **Essentiel 69 / Croissance 129 / Premium 199
CHF/mo** (200 / 750 / 2 000 active cards; an "active card" = activity within 90
days). The product replaces paper stamp cards with a no-install, native-wallet
experience the merchant controls from a white-label dashboard.

Success looks like: a merchant onboarded in minutes, scanning customers at the
counter without friction, and a landing page that converts Geneva shop owners
who have never bought SaaS before. Field prospecting begins mid-July 2026.

## Brand Personality

**Clair · Élégant · Vibrant.** A confident, warm, artisan voice — Swiss-French
(vouvoiement, direct artisan tone, zero SaaS jargon). Premium without being
precious; the émeraude/onyx/calcaire palette and Fraunces serif signal craft
and trust, not tech hype. The brand should feel like a well-made object a
proud independent merchant would want associated with their counter.

Emotional goals: **trust** (handling their customer relationships), **calm
competence** (it just works mid-service), and a small **moment of delight** at
the reward beat (the reserved gold accent, used only when a customer earns a
reward — never as a brand color).

## Anti-references

Confirmed directions this must explicitly **NOT** look like:

- **Generic SaaS template** — cream/sand bg, gradient blobs, hero-metric
  template, identical icon-heading-text card grids, Stripe/Linear-clone defaults.
- **Loud fintech / crypto** — neon-on-black, aggressive gradients, decorative
  glassmorphism, hype energy. Too flashy for a Geneva artisan tool.
- **Corporate / cold enterprise** — navy-and-gray, dense, soulless B2B
  dashboards. Kills the élégant-artisan warmth.
- **Childish loyalty app** — cartoon mascots, bright primary colors, gamified
  badges everywhere. The consumer punch-card-app cliché.

## Design Principles

1. **Counter-first ergonomics.** The merchant uses this mid-service, rushed,
   one-handed. Critical actions (scan, reward) are big, fast, forgiving, and
   unmistakable. Optimize the hot path over the feature list.
2. **Earned warmth, restrained surface.** The palette is mostly onyx/calcaire
   calm; émeraude carries identity; the gold reward accent is rationed to the
   one moment it means something. Warmth comes from type, copy, and craft — not
   from tinting every surface.
3. **Trust is the feature.** This holds merchants' customer relationships and
   wallet credentials. Visual polish, clear states, and honest copy all signal
   "safe to hand my customers." No dark patterns, no fake urgency.
4. **Artisan voice, not SaaS voice.** Swiss-French, direct, jargon-free. The
   interface speaks like a competent peer, not a growth funnel.
5. **Subtle motion as quality signal.** 150–300ms, transform/opacity, reduced
   motion respected. The holographic card sheen and reward flourish are kept
   low-opacity and purposeful — premium, never busy.

## Accessibility & Inclusion

- **WCAG AA.** Body text on onyx ≥ 4.5:1 (calcaire/white); galet muted reserved
  for ≥ 3:1 large text only. Placeholder text held to body contrast.
- **Reduced motion** is mandatory: every animation has a `prefers-reduced-motion:
  reduce` path (framer `useReducedMotion` + CSS guard). Holographic/sheen
  effects disable under reduced motion.
- **Responsive** 375 / 768 / 1024 / 1440; no horizontal scroll; `min-h-dvh`.
- Visible focus rings; `cursor-pointer` on clickables; lucide icons only (no
  emoji), consistent 1.5–2px stroke.
- Primary language is **French (CH)**; copy must remain legible and correctly
  accented; one primary CTA per section to limit cognitive load.
