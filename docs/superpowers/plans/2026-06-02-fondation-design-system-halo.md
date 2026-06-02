# Fondation Design System HALO — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation design HALO (nouvelle DA claire « précision suisse ») — tokens, polices Newsreader/Inter, grammaire de mouvement, composants de base — et l'appliquer à la landing en preuve, sans casser les surfaces existantes.

**Architecture:** Additif et non cassant. On **conserve** les tokens existants (`onyx`, `calcaire`, `halo`…) pour que dashboard/admin/scan continuent de fonctionner, et on **ajoute** la couche claire (tokens sémantiques + ivoire/encre/or). Migration surface par surface : seule la **landing** est migrée ici. Composants maison sur Tailwind v4 `@theme` + helpers framer-motion.

**Tech Stack:** Next.js 16 · React 19 · Tailwind v4 (`@theme`) · framer-motion 12 · next/font · Vitest 4 · lucide-react.

**Vérification :** pas de TDD classique (design/CSS). La vérif de chaque tâche = `npm run build` (types) + `npm run lint` qui passent, et un test Vitest léger là où c'est pertinent (logique de variants).

---

## Fichiers touchés

- `src/app/globals.css` — **modifier** : ajouter tokens clairs + sémantiques + mouvement + garde reduced-motion (conserver l'existant).
- `src/app/layout.tsx` — **modifier** : Fraunces → Newsreader (garder Inter + Geist Mono).
- `src/components/motion/` — **créer** : `Reveal.tsx`, `Stagger.tsx`, `Press.tsx`, `useHaloMotion.ts`, `Celebrate.tsx`, `index.ts`.
- `src/components/ui/` — **créer** : `cn.ts`, `Button.tsx`, `Card.tsx`, `Chip.tsx`, `Divider.tsx`, `SectionHeading.tsx`, `Skeleton.tsx`, `Wordmark.tsx`, `Field.tsx`, `Toast.tsx`, `index.ts`.
- `src/components/ui/__tests__/Button.test.tsx` — **créer** : test variants.
- `src/components/landing/LoyaltyCard.tsx` — **modifier** : style de référence clair.
- `src/app/page.tsx` — **modifier** : hero migré vers la DA claire (preuve).
- `design-system/MASTER.md` — **modifier** : refléter la nouvelle DA claire.

---

### Task 1: Tokens design clairs + mouvement (globals.css)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Ajouter le bloc de tokens clairs dans `@theme`**

Dans le `@theme` existant (après les couleurs onyx/halo, **sans les supprimer**), ajouter :

```css
  /* HALO — DA claire (precision suisse) */
  --color-ivoire: #F4F1E9;
  --color-ivoire-2: #FBF9F3;
  --color-surface: #FFFFFF;
  --color-ink: #14150F;
  --color-emerald: #0D6B5E;        /* = halo, alias semantique */
  --color-emerald-strong: #0A574C;
  --color-gold: #C9A56B;
  --color-line: rgba(20, 21, 15, 0.14);

  /* Polices : display passe a Newsreader */
  --font-display: var(--font-newsreader);

  /* Rayons */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  /* Ombres douces (teintees encre) */
  --shadow-sm: 0 1px 2px rgba(20,21,15,.06), 0 1px 1px rgba(20,21,15,.04);
  --shadow-md: 0 8px 20px -10px rgba(20,21,15,.25);
  --shadow-lg: 0 24px 48px -22px rgba(20,21,15,.35);
  --shadow-emerald: 0 10px 24px -10px rgba(13,107,94,.45);

  /* Easings mouvement */
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-in: cubic-bezier(.4, 0, 1, 1);
```

> Note : `--font-display` existait (= Fraunces). On le remplace par `--font-newsreader` (défini en Task 2). Garder `--font-sans`/`--font-mono`.

- [ ] **Step 2: Ajouter les tokens sémantiques + durées sur `:root`**

Après le bloc `:root { --background … }` existant, ajouter un nouveau bloc :

```css
:root {
  /* Tokens semantiques HALO clair (a utiliser dans les composants) */
  --bg: #F4F1E9;
  --surface: #FFFFFF;
  --surface-2: #FBF9F3;
  --text: #14150F;
  --text-muted: #8A8A82;
  --primary: #0D6B5E;
  --primary-strong: #0A574C;
  --accent: #C9A56B;
  --line: rgba(20, 21, 15, 0.14);
  --focus: #1FB89A;

  --dur-fast: 150ms;
  --dur-base: 220ms;
  --dur-slow: 320ms;
}
```

- [ ] **Step 3: Garde globale `prefers-reduced-motion`**

À la fin du fichier, ajouter :

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: build OK (les surfaces existantes utilisent toujours onyx/calcaire, intactes).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): tokens DA claire HALO + mouvement (additif, non cassant)"
```

---

### Task 2: Police Newsreader (layout.tsx)

**Files:**
- Modify: `src/app/layout.tsx:2`, `:5-12`, `:38`

- [ ] **Step 1: Importer Newsreader, retirer Fraunces**

Remplacer l'import ligne 2 :

```tsx
import { Newsreader, Inter, Geist_Mono } from "next/font/google";
```

Remplacer la déclaration `fraunces` (lignes 5-12) par :

```tsx
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});
```

- [ ] **Step 2: Mettre à jour la className `<html>`**

Remplacer `${fraunces.variable}` par `${newsreader.variable}` :

```tsx
className={`${newsreader.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
```

- [ ] **Step 3: Vérifier build + grep**

Run: `npm run build && grep -rn "font-fraunces\|Fraunces" src/ || echo "plus de Fraunces"`
Expected: build OK. Les titres en `font-display` rendent désormais en Newsreader.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(design): police titres Newsreader (remplace Fraunces)"
```

---

### Task 3: Helpers de mouvement (framer-motion)

**Files:**
- Create: `src/components/motion/useHaloMotion.ts`, `Reveal.tsx`, `Stagger.tsx`, `Press.tsx`, `Celebrate.tsx`, `index.ts`

- [ ] **Step 1: `useHaloMotion.ts`**

```tsx
"use client";
import { useReducedMotion } from "framer-motion";

/** Renvoie true si l'utilisateur demande moins de mouvement. */
export function useHaloMotion() {
  const reduced = useReducedMotion();
  return { reduced: !!reduced };
}
```

- [ ] **Step 2: `Reveal.tsx`**

```tsx
"use client";
import { motion } from "framer-motion";
import { useHaloMotion } from "./useHaloMotion";
import type { ReactNode } from "react";

export function Reveal({ children, delay = 0, y = 16 }: { children: ReactNode; delay?: number; y?: number }) {
  const { reduced } = useHaloMotion();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: `Stagger.tsx`**

```tsx
"use client";
import { motion } from "framer-motion";
import { useHaloMotion } from "./useHaloMotion";
import type { ReactNode } from "react";

export function Stagger({ children, gap = 0.04 }: { children: ReactNode; gap?: number }) {
  const { reduced } = useHaloMotion();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, y = 14 }: { children: ReactNode; y?: number }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: `Press.tsx`**

```tsx
"use client";
import { motion } from "framer-motion";
import { useHaloMotion } from "./useHaloMotion";
import type { ReactNode } from "react";

export function Press({ children, className }: { children: ReactNode; className?: string }) {
  const { reduced } = useHaloMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: `Celebrate.tsx` (confettis sobres, dépendance-zéro)**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { useHaloMotion } from "./useHaloMotion";

/** Confettis sobres emeraude/or sur un canvas leger. Respecte reduced-motion. */
export function Celebrate({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reduced } = useHaloMotion();
  useEffect(() => {
    if (!fire || reduced) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = (cv.width = cv.offsetWidth), H = (cv.height = cv.offsetHeight);
    const colors = ["#0D6B5E", "#1FB89A", "#C9A56B"];
    const parts = Array.from({ length: 80 }, (_, i) => ({
      x: W / 2, y: H / 2, r: 3 + (i % 3),
      a: (i / 80) * Math.PI * 2, v: 2 + (i % 5),
      c: colors[i % 3], life: 1,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.x += Math.cos(p.a) * p.v; p.y += Math.sin(p.a) * p.v + 1.2; p.life -= 0.012;
        if (p.life > 0) { alive = true; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      }
      if (alive) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [fire, reduced]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
```

- [ ] **Step 6: `index.ts`**

```tsx
export { Reveal } from "./Reveal";
export { Stagger, StaggerItem } from "./Stagger";
export { Press } from "./Press";
export { Celebrate } from "./Celebrate";
export { useHaloMotion } from "./useHaloMotion";
```

- [ ] **Step 7: Build + commit**

Run: `npm run build`
```bash
git add src/components/motion
git commit -m "feat(motion): helpers Reveal/Stagger/Press/Celebrate + garde reduced-motion"
```

---

### Task 4: Primitives UI de base

**Files:**
- Create: `src/components/ui/cn.ts`, `Button.tsx`, `Card.tsx`, `Chip.tsx`, `Divider.tsx`, `SectionHeading.tsx`, `Skeleton.tsx`, `Wordmark.tsx`, `index.ts`
- Test: `src/components/ui/__tests__/Button.test.tsx`

- [ ] **Step 1: `cn.ts` (helper classes)**

```tsx
import { clsx, type ClassValue } from "clsx";
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
```

- [ ] **Step 2: `Button.tsx`**

```tsx
import { cn } from "./cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "solid" | "ghost" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-semibold transition-[transform,background-color,box-shadow] duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--primary)] text-white shadow-[var(--shadow-emerald)] hover:bg-[var(--primary-strong)]",
  solid: "bg-[var(--text)] text-[var(--bg)] hover:opacity-90",
  ghost: "bg-transparent text-[var(--text)] border border-[var(--line)] hover:bg-[var(--surface-2)]",
  link: "bg-transparent text-[var(--primary)] underline-offset-4 hover:underline px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({
  variant = "primary", size = "md", loading = false, className, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={cn(base, variants[variant], variant !== "link" && sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}
```

- [ ] **Step 3: `Card.tsx`**

```tsx
import { cn } from "./cn";
import type { HTMLAttributes } from "react";

export function Card({
  elevated = false, className, ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--line)]",
        elevated ? "shadow-[var(--shadow-lg)]" : "shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: `Chip.tsx`**

```tsx
import { cn } from "./cn";
import type { HTMLAttributes } from "react";

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 5: `Divider.tsx`**

```tsx
export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 h-px bg-[var(--line)] ${className}`} />;
}
```

- [ ] **Step 6: `SectionHeading.tsx`**

```tsx
import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">{eyebrow}</p>
      )}
      <h2 className="mt-3 font-display text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.01em] text-[var(--text)]">{title}</h2>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 7: `Skeleton.tsx`**

```tsx
import { cn } from "./cn";
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]", className)} aria-hidden />;
}
```

- [ ] **Step 8: `Wordmark.tsx`**

```tsx
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[1px] font-display text-[21px] font-medium text-[var(--text)] ${className}`}>
      HAL
      <span className="inline-block h-[0.62em] w-[0.62em] rounded-full border-2 border-current" aria-hidden />
      <span className="sr-only">HALO</span>
    </span>
  );
}
```

- [ ] **Step 9: `index.ts`**

```tsx
export { Button } from "./Button";
export { Card } from "./Card";
export { Chip } from "./Chip";
export { Divider } from "./Divider";
export { SectionHeading } from "./SectionHeading";
export { Skeleton } from "./Skeleton";
export { Wordmark } from "./Wordmark";
```

- [ ] **Step 10: Test variants Button**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("rend le label et applique la variante primary par defaut", () => {
    render(<Button>Créer ma carte</Button>);
    const btn = screen.getByRole("button", { name: "Créer ma carte" });
    expect(btn.className).toContain("var(--primary)");
  });
  it("est desactive et aria-busy en loading", () => {
    render(<Button loading>X</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });
});
```

> Si `@testing-library/react` n'est pas installé : `npm i -D @testing-library/react @testing-library/jest-dom jsdom` et configurer `vitest` en environnement `jsdom`. Vérifier d'abord les tests existants pour suivre la config en place.

- [ ] **Step 11: Build + test + commit**

Run: `npm run build && npm run test`
Expected: build OK, test Button vert.
```bash
git add src/components/ui
git commit -m "feat(ui): primitives Button/Card/Chip/Divider/SectionHeading/Skeleton/Wordmark + test"
```

---

### Task 5: Field + Toast (formulaire & feedback)

**Files:**
- Create: `src/components/ui/Field.tsx`, `src/components/ui/Toast.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: `Field.tsx`**

```tsx
"use client";
import { cn } from "./cn";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label, error, helper, className, ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; helper?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--text)]">{label}</label>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : helper ? `${id}-help` : undefined}
        className={cn(
          "h-11 rounded-[var(--radius-md)] border bg-[var(--surface)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-shadow",
          "focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
          error ? "border-red-500" : "border-[var(--line)]",
          className
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[12px] text-red-600">{error}</p>
      ) : helper ? (
        <p id={`${id}-help`} className="text-[12px] text-[var(--text-muted)]">{helper}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: `Toast.tsx`**

```tsx
"use client";
import { useEffect } from "react";
import { cn } from "./cn";

export function Toast({
  message, open, onClose, tone = "success", duration = 4000,
}: { message: string; open: boolean; onClose: () => void; tone?: "success" | "error"; duration?: number }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);
  if (!open) return null;
  return (
    <div
      aria-live="polite"
      className={cn(
        "fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-full px-4 py-2.5 text-[13px] font-medium shadow-[var(--shadow-lg)]",
        tone === "success" ? "bg-[var(--text)] text-[var(--bg)]" : "bg-red-600 text-white"
      )}
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 3: Étendre `index.ts`**

```tsx
export { Field } from "./Field";
export { Toast } from "./Toast";
```

- [ ] **Step 4: Build + commit**

Run: `npm run build`
```bash
git add src/components/ui
git commit -m "feat(ui): Field (label/erreur/a11y) + Toast (aria-live)"
```

---

### Task 6: Restyle LoyaltyCard (style de référence clair)

**Files:**
- Modify: `src/components/landing/LoyaltyCard.tsx`

> Le composant `LoyaltyCard` existe (cartes sombres `linear-gradient`). On ajoute une **variante claire** « surface blanche + hairline + filet émeraude + nom Newsreader », pilotée par les tokens, avec holo conservé subtil et désactivé sous reduced-motion. Réutiliser le prototype premium de `~/Desktop` (profondeur, contactless, `tabular-nums`) comme référence visuelle.

- [ ] **Step 1: Lire l'existant**

Run: `sed -n '1,40p' src/components/landing/LoyaltyCard.tsx`
Repérer le type `CardData`, `MechanicView`, et le conteneur racine.

- [ ] **Step 2: Conteneur clair**

Remplacer le style du conteneur racine (fond sombre) par une carte claire :

```tsx
// conteneur racine
className="group relative isolate flex aspect-[1.62/1] flex-col justify-between overflow-hidden rounded-[16px] bg-[var(--surface)] p-5 text-[var(--text)] ring-1 ring-[var(--line)] shadow-[var(--shadow-md)]"
```

Ajouter le filet émeraude vertical à droite :

```tsx
<span className="absolute inset-y-0 right-0 z-[4] w-[5px] bg-[var(--primary)]" aria-hidden />
```

- [ ] **Step 3: Nom du commerçant en Newsreader**

```tsx
<p className="font-display text-[17px] font-medium leading-tight">{name}</p>
<p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{type}</p>
```

- [ ] **Step 4: Tampons/jauge en émeraude + `tabular-nums` sur les chiffres**

Dans `MechanicView`, utiliser `var(--primary)` pour les accents et ajouter `tabular-nums` aux paragraphes de chiffres (points/cashback/pass).

- [ ] **Step 5: Build + commit**

Run: `npm run build`
```bash
git add src/components/landing/LoyaltyCard.tsx
git commit -m "feat(card): style de reference clair (surface, hairline, filet emeraude, Newsreader)"
```

---

### Task 7: Appliquer la DA claire à la landing (hero — preuve)

**Files:**
- Modify: `src/app/page.tsx` (section nav + hero uniquement)

> On migre **uniquement** la nav + le hero vers la DA claire en preuve. Les autres sections de la landing peuvent suivre ensuite. Utiliser les composants `Wordmark`, `Button`, `SectionHeading`, `Chip`, `Reveal`.

- [ ] **Step 1: Repérer nav + hero**

Run: `grep -n "bg-onyx\|<nav\|hero\|Hero\|<section" src/app/page.tsx | head -20`

- [ ] **Step 2: Fond clair**

Le wrapper de page : `bg-onyx` → `bg-[var(--bg)]` ; texte `text-calcaire` → `text-[var(--text)]`.

- [ ] **Step 3: Nav**

Remplacer le logo par `<Wordmark />`, les liens en `text-[var(--text-muted)] hover:text-[var(--text)]`, le CTA par `<Button>Créer ma carte</Button>`, la connexion par `<Button variant="ghost" size="sm">Connexion</Button>`.

- [ ] **Step 4: Hero**

Eyebrow en `<Chip>`, titre via `font-display` (Newsreader) avec emphase italique émeraude sur « à votre image. », sous-titre `text-[var(--text-muted)]`, double CTA (`primary` + `ghost`). Envelopper d'un `<Reveal>`.

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: OK, hero clair rendu.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): nav + hero migres vers la DA claire (preuve fondation)"
```

---

### Task 8: Mettre à jour MASTER.md + vérif finale

**Files:**
- Modify: `design-system/MASTER.md`

- [ ] **Step 1: Réécrire la section « Brand »** pour la DA claire

Remplacer la palette sombre par : Ivoire `#F4F1E9` (fond), Surface `#FFFFFF`, Encre `#14150F`, Émeraude `#0D6B5E` (+ glow `#1FB89A`), Or `#C9A56B`, Galet `#8A8A82`. Type : **display = Newsreader**, body = Inter, mono = Geist Mono. Mode **clair uniquement**. Mentionner les tokens sémantiques (`--bg`, `--surface`, `--text`, `--primary`, `--line`, `--focus`) et les helpers de mouvement.

- [ ] **Step 2: Vérif finale complète**

Run: `npm run build && npm run lint && npm run test`
Expected: tout vert.

- [ ] **Step 3: Commit**

```bash
git add design-system/MASTER.md
git commit -m "docs(design): MASTER.md reflete la DA claire HALO (Newsreader, tokens semantiques)"
```

---

## Self-Review

**Couverture spec :** tokens (T1) · Newsreader (T2) · mouvement+reduced-motion (T3) · primitives (T4) · Field/Toast (T5) · carte héros (T6) · preuve landing (T7) · MASTER.md (T8). ✅ Tout point de la spec §3/§5 a une tâche. Dark mode = hors périmètre (non planifié, voulu).

**Placeholders :** aucun « TBD/TODO » ; chaque step de code montre le code.

**Cohérence des types :** tokens sémantiques (`--bg`,`--surface`,`--text`,`--primary`,`--primary-strong`,`--accent`,`--line`,`--focus`) définis en T1 et utilisés tels quels en T4-T7. `useHaloMotion()` défini en T3, utilisé par Reveal/Stagger/Press/Celebrate. `cn()` défini en T4 step1 avant usage.

**Risque connu :** `@testing-library/react` peut manquer (T4 step10 prévoit l'install + fallback) ; le restyle landing complet (au-delà du hero) et les surfaces B/C/D sont volontairement hors de ce plan.
