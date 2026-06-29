---
target: src/app/(marketing)
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-06-27T11-14-50Z
slug: src-app-marketing-homeclient-tsx
---
# Critique — HALO marketing landing (`src/app/(marketing)/HomeClient.tsx`)

Register: **brand** (the B2B landing sells to Geneva merchants). Browser visualization unavailable in this environment — no browser automation; assessment is source review + deterministic detector.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Nav scroll-state + FAQ open states good; no scroll-spy active section, primary action is offsite (`/demarrer`) |
| 2 | Match System / Real World | 4 | Excellent Swiss-French artisan copy; "carte active" defined inline; no jargon |
| 3 | User Control and Freedom | 3 | Anchor nav + collapsible FAQ; no traps. Low-stakes landing |
| 4 | Consistency and Standards | 4 | Tokens/components rigorously consistent (arguably *too* uniform — see Aesthetic) |
| 5 | Error Prevention | 3 | No on-page forms; routes cleanly to the form. n/a-leaning |
| 6 | Recognition Rather Than Recall | 4 | Labelled nav, visible options, no memorization |
| 7 | Flexibility and Efficiency | 3 | Anchor jumps; no skip-to-content link; no mobile section nav |
| 8 | Aesthetic and Minimalist Design | 2 | Eyebrow-on-every-section scaffolding + five near-identical card grids flatten the visual rhythm |
| 9 | Error Recovery | 3 | n/a on-page; FAQ + contact CTA cover the soft path |
| 10 | Help and Documentation | 4 | Strong FAQ section + "posez-la nous" contact path |
| **Total** | | **33/40** | **Good — solid, on-brand, two AI-grammar tells holding it back from Excellent** |

## Anti-Patterns Verdict

**Does this look AI-generated? Partially — distinctive skin, generic skeleton.**

**LLM assessment:** The *identity* is genuinely distinctive and avoids the obvious reflexes: émeraude-on-calcaire (not SaaS-cream, not navy enterprise), Fraunces display with a real italic-émeraude emphasis device ("à votre image", "zéro complexité", "sa carte") that reads as authored voice, and a white-label LoyaltyCard gallery doing the imagery work a brand surface needs. That's the second-order slop test passed on palette and type.

But the *structure* lands in two saturated AI lanes:
1. **A tiny uppercase tracked eyebrow above every section** — 7 of them (`text-xs uppercase tracking-[0.3em] text-galet-ink`: "Fonctionnement", "Les mécaniques", "Les exemples", "Pourquoi HALO", "Ils utilisent HALO", "Tarifs", "Questions fréquentes"), plus the hero badge. This is the single most-cited AI-landing tell, and it's on every fold.
2. **Five consecutive icon-chip card grids** — Steps, Mechanics, Why, Testimonials, Pricing are all `rounded-2xl border border-line-warm bg-surface` cards, four of them leading with the same `bg-halo/15` rounded-square lucide icon. Same module, same weight, same rhythm, scrolled five times.

**Deterministic scan:** `detect.mjs` returned `[]` (exit 0) — clean. This is a miss, not a clearance: the detector keys on literal patterns and didn't flag the Tailwind arbitrary-value eyebrows (`tracking-[0.3em]`) or the card-grid repetition. The LLM review caught both. Treat the clean scan as "no hard-banned literals" (no `border-left` stripes, no gradient text, no glass), not as "no AI tells."

**Visual overlays:** none — browser automation isn't available here, so no in-page overlay was injected. Findings are from source review.

## Overall Impression

This is a confident, on-brand landing that a Geneva merchant would trust — the palette, type, copy, and honest pricing are genuinely good, and the integrity (labelling the testimonials as illustrative, defining "carte active") is rare and admirable. The single biggest opportunity: the page is **skinned beautifully but scaffolded generically**. Strip the per-section eyebrows and break the card-grid monotony, and it jumps from "nice SaaS landing" to "a brand with a point of view" — which is exactly what brand register demands ("go big or go home").

## What's Working

- **The italic-émeraude emphasis device.** Fraunces light with the last phrase set in italic émeraude is a real, repeatable brand signature — it carries voice without gimmicks. Keep it.
- **Honest, specific copy.** Swiss-French, artisan tone, concrete examples per mechanic, "carte active" defined where money is discussed, testimonials openly flagged as illustrative. This is trust-building done right.
- **Reduced-motion is correct.** The `Reveal` helper genuinely branches on `useReducedMotion` (`initial={reduce ? false : ...}`) rather than faking it — reveals enhance an already-visible default, so nothing ships blank.

## Priority Issues

- **[P1] Eyebrow above every section (AI scaffolding).** *What:* 7 tiny uppercase tracked kickers, one per section, plus the hero badge. *Why it matters:* It's the textbook AI-landing tell on a conversion surface meant to feel artisanal and bespoke; it quietly signals "templated." *Fix:* Delete the eyebrows. Let the Fraunces headlines open each section — they're strong enough alone. If you want a connective device, use one named brand kicker deliberately (once), not section grammar. *Command:* `/impeccable typeset` (or `quieter`).

- **[P1] Muted text fails WCAG AA via opacity.** *What:* `text-galet-ink/70` (mechanics example line, l.273) computes to ~#999B9D on white ≈ **2.8:1**; `text-galet-ink/60` (testimonials disclaimer l.336) on calcaire is worse. Body/large minimum is 4.5/3:1. *Why it matters:* Sub-AA text on a page targeting non-technical merchants (some older) is a real legibility + accessibility failure. *Fix:* Drop the opacity modifiers; use solid `galet-ink` (#6E7073, ~5:1) or define a dedicated lighter-but-compliant muted token. Never dilute an already-muted gray with `/70`. *Command:* `/impeccable audit` then `/impeccable colorize`.

- **[P2] Five near-identical card grids (layout monotony).** *What:* Steps / Mechanics / Why / Testimonials / Pricing are the same card module repeated. *Why it matters:* Brand register rewards art-direction-per-section; uniform modules read as generated. *Fix:* Differentiate at least two — e.g. "Pourquoi HALO" as an alternating feature-row layout or a spotlight, "Mécaniques" as a horizontal snap-scroll or an editorial list — keeping the card grid for Pricing where it's the right affordance. *Command:* `/impeccable layout` (or `bolder`).

- **[P2] Placeholder testimonials on a launch surface.** *What:* Three fabricated quotes, honestly labelled "à remplacer par de vrais avis", ship on the page weeks before mid-July prospecting. *Why it matters:* Self-labelled fake social proof undercuts the trust it's meant to build; a sharp merchant reads the disclaimer and discounts the section. *Fix:* Replace with 1–2 real pilot quotes before launch, or pull the section until you have them rather than show illustrative ones. *Command:* `/impeccable clarify` (content) — but really a real-content task.

- **[P3] Heading wrap + mobile section nav.** *What:* No `text-wrap: balance` on h1/h2 (relies on a manual `<br className="hidden sm:block">` in the hero, which can wrap awkwardly under browser translation/long words); the section nav is `hidden md:flex` with no mobile menu, so phone users can't jump to Tarifs/FAQ. *Fix:* Add `text-balance` to headings and drop the manual break; add a minimal mobile menu or sticky "Tarifs" jump. *Command:* `/impeccable adapt`.

## Persona Red Flags

**Jordan (Confused First-Timer):** Largely safe — copy is plain Swiss-French, the first action ("Créer ma carte") is unmistakable, "carte active" is defined inline. No real blockers; the eyebrows add no comprehension cost, just slop.

**Casey (Distracted Mobile User):** The desktop section nav vanishes on mobile (`hidden md:flex`) with no hamburger — to reach Tarifs or FAQ she must scroll the entire page one-handed. CTAs themselves are thumb-friendly (py-3.5/py-4 ≈ ≥44px) and repeated, so conversion still works; wayfinding doesn't.

**Project persona — "Camille" (non-technical Geneva café owner, time-poor, trust-driven):** Pricing clarity and zero-jargon copy serve her well. But she's exactly the reader who'll notice the "témoignages illustratifs" disclaimer and the sub-AA grey small print — the two things that quietly erode "can I trust these people with my customers?"

## Minor Observations

- `01 / 02 / 03` in How-it-works is the *legitimate* use of numbered markers (it's a real ordered sequence) — keep it; it's not the scaffolding anti-pattern.
- No skip-to-content link for keyboard users landing on a fixed nav.
- Anchor nav has no active-section indication (scroll-spy) — cheap polish.
- `selection:bg-halo/40` is a nice on-brand touch.

## Questions to Consider

- What would the "go big" version of this look like — one section that breaks the grid entirely and makes a visitor ask *how was this made?*
- Do all five proof sections need to be cards, or is the card the reflex rather than the right affordance?
- If you removed every eyebrow tomorrow, would you lose any information — or just the scaffolding?
