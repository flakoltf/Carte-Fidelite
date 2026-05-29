# HALO — Design System (MASTER)

> Source of truth for UI. Brand details: `docs/brand-guidelines.md`. Tokens: `assets/design-tokens.css`.
> Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 · framer-motion · lucide-react.

## Brand (locked — do NOT override with generic recommendations)
- **Accent / primary:** Émeraude `#0D6B5E` (glow `#1FB89A`)
- **Base:** Onyx `#0E0F11` · Calcaire `#F3F0E9` · Galet `#9B9DA0`
- **Type:** display = Canela → free sub **Fraunces** (serif, italic for emphasis); body = Söhne → free sub **Inter**
- **Voice:** Clair · Élégant · Vibrant. Language: **French (CH)**.
- **Logo:** thin circle ("halo") + single light glint; O of "HALO" wordmark = the halo.

## Tailwind brand utilities (defined in `src/app/globals.css` @theme)
`bg-onyx` `bg-onyx-soft` `text-calcaire` `text-galet` `bg-halo` `text-halo` `text-halo-glow` `border-onyx-line` · `font-display` (Fraunces) · `font-sans` (Inter)

## Landing pattern (SaaS B2B — sells to merchants)
Order: Nav · Hero · How-it-works (3 steps) · 5 mechanics · Card gallery (white-label showcase) · Why HALO (4 args) · Testimonials · Pricing · Final CTA · Footer.
Primary CTA: "Créer ma carte" → `/signup`. Secondary: "Connexion" → `/login`.

## Non-negotiable UX rules (from ui-ux-pro-max)
- Icons: **lucide-react only, no emoji**. Consistent stroke (1.5–2px).
- Contrast AA: text on onyx ≥4.5:1 (calcaire/white body; galet for muted ≥3:1 large only).
- Motion 150–300ms, transform/opacity only; **respect `prefers-reduced-motion`** (framer `useReducedMotion` + CSS guard).
- Responsive 375/768/1024/1440; no horizontal scroll; `min-h-dvh`.
- One primary CTA per section; visible focus rings; `cursor-pointer` on clickables.
- Holographic card effect kept **subtle** (low opacity), disabled under reduced-motion.

## Scope guard
Only touch: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, new `src/components/**`. Do NOT modify dashboard/admin/scan/login/signup/api/supabase.
