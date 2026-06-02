# HALO — Design System (MASTER)

> Source of truth for UI. Brand details: `docs/brand-guidelines.md`. Tokens: `assets/design-tokens.css`.
> Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 · framer-motion · lucide-react.

## Brand — DA « précision suisse », claire & premium (locked)
> Refonte 2026-06-02 : on garde le nom HALO, nouvelle direction artistique **claire** (mode clair uniquement). Validée en brainstorming visuel (A1 contrastée). Spec : `docs/superpowers/specs/2026-06-02-fondation-design-system-halo-design.md`.
- **Base :** Ivoire `#F4F1E9` (fond) · Surface `#FFFFFF` · Ivoire-2 `#FBF9F3` (sections)
- **Texte / encre :** `#14150F` · muted Galet `#8A8A82`
- **Accent / primary :** Émeraude `#0D6B5E` (strong `#0A574C`, glow/focus `#1FB89A`)
- **Accent secondaire (discret) :** Or `#C9A56B`
- **Filets :** `--line` `rgba(20,21,15,.14)` — hairlines, grille stricte, beaucoup d'air.
- **Type :** display & marque = **Newsreader** (serif, italique pour l'emphase) ; corps/UI = **Inter** ; données = Geist Mono.
- **Voice :** Clair · Élégant · Précis. Language: **French (CH)**.
- **Logo :** thin circle ("halo") + single light glint; O of "HALO" wordmark = the halo (`<Wordmark/>`).

## Tokens & utilities (dans `src/app/globals.css`)
- **Tokens sémantiques (à utiliser dans les composants) :** `--bg` `--surface` `--surface-2` `--text` `--text-muted` `--primary` `--primary-strong` `--accent` `--line` `--focus` · durées `--dur-fast/base/slow` · `--radius-sm/md/lg/xl` · `--shadow-sm/md/lg/emerald` · `--ease-out/in`.
- **Utilities Tailwind clairs :** `bg-ivoire` `bg-surface` `text-ink` `text-emerald` `text-gold` `text-galet` · `font-display` (**Newsreader**) `font-sans` (Inter) `font-mono`.
- **Legacy (conservés, non supprimés)** pour les surfaces pas encore migrées : `bg-onyx` `text-calcaire` `bg-halo`… → à retirer surface par surface.

## Composants & mouvement (réutilisables)
- **UI :** `src/components/ui/` — `Button` (primary/solid/ghost/link), `Card`, `Chip`, `Field`, `Toast`, `Skeleton`, `Divider`, `SectionHeading`, `Wordmark`. N'utilisent que les tokens sémantiques (aucun hex en dur).
- **Mouvement :** `src/components/motion/` — `Reveal`, `Stagger`/`StaggerItem`, `Press`, `Celebrate`, `useHaloMotion` (garde `prefers-reduced-motion`).

## Landing pattern (SaaS B2B — sells to merchants)
Order: Nav · Hero · How-it-works (3 steps) · 5 mechanics · Card gallery (white-label showcase) · Why HALO (4 args) · Testimonials · Pricing · Final CTA · Footer.
Primary CTA: "Créer ma carte" → `/signup`. Secondary: "Connexion" → `/login`.

## Non-negotiable UX rules (from ui-ux-pro-max)
- Icons: **lucide-react only, no emoji**. Consistent stroke (1.5–2px).
- Contrast AA: encre `#14150F` sur ivoire ≈15:1; émeraude réservée aux accents/boutons (≈4.7:1, pas le corps); galet pour muted ≥3:1 large only.
- Motion 150–300ms, transform/opacity only; **respect `prefers-reduced-motion`** (framer `useReducedMotion` + CSS guard).
- Responsive 375/768/1024/1440; no horizontal scroll; `min-h-dvh`.
- One primary CTA per section; visible focus rings; `cursor-pointer` on clickables.
- Holographic card effect kept **subtle** (low opacity), disabled under reduced-motion.

## Scope guard
Only touch: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, new `src/components/**`. Do NOT modify dashboard/admin/scan/login/signup/api/supabase.

## Migration status (sous-projet F — Fondation)
- ✅ Fait : tokens clairs (additif), Newsreader, helpers mouvement, primitives UI, MASTER.md.
- ⏳ À faire avec revue visuelle : migration **complète** de la landing (`page.tsx`) onyx→ivoire (toutes sections, pas seulement le hero, sinon rendu incohérent) + restyle `LoyaltyCard` clair.
- 🔜 Sous-projets suivants : B (espace client), A (carte Wallet), C (commerçant), D (admin).
