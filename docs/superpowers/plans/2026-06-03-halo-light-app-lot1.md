# HALO Light — App Redesign Lot 1 (login + dashboard) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter l'identité HALO en mode clair sur le login, le shell du dashboard et la page Vue d'ensemble, en remplaçant le thème sombre « WalletCard » par la palette HALO Light.

**Architecture:** Refonte purement visuelle (CSS/Tailwind v4). On ajoute 3 tokens « light » dans `globals.css`, puis on convertit les classes sombres (`zinc-*`, `bg-white text-black`) vers les tokens HALO (`bg-calcaire`, `bg-surface`, `text-onyx`, `bg-halo`, `border-line-warm`). La marque `WalletCard` + l'icône `Wallet` sont remplacées par le composant `HaloMark` + le mot « HALO ». La landing (sombre) n'est pas touchée.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (`@theme`), Recharts, lucide-react, framer-motion. Pas de Vitest (aucune logique pure) — validation par build + captures Playwright.

**Spec :** `docs/superpowers/specs/2026-06-03-halo-light-app-design.md`

---

## Référence : table de substitution sombre → HALO Light

Cette table est utilisée dans plusieurs tâches. Elle est la source de vérité des conversions.

| Sombre (actuel) | HALO Light (cible) |
|---|---|
| `bg-zinc-950` / `bg-zinc-900` (fond page/shell) | `bg-calcaire` |
| `bg-zinc-900/40`, `bg-zinc-900/50` (cartes) | `bg-surface shadow-sm` |
| `border-zinc-800`, `border-zinc-900` | `border-line-warm` |
| `text-white` (titres) | `text-onyx` |
| `text-zinc-300` | `text-onyx` |
| `text-zinc-400`, `text-zinc-500`, `text-zinc-600` (secondaire) | `text-galet-ink` |
| `placeholder:text-zinc-700` | `placeholder:text-galet` |
| `text-emerald-400` | `text-halo` |
| `bg-emerald-500/10 ... text-emerald-400 border-emerald-500/20` (nav active) | `bg-halo text-white` |
| bouton `bg-white text-black hover:bg-zinc-200` | `bg-halo text-white hover:bg-halo-600` |
| Recharts tick `fill: "#71717a"` | `fill: "#6E7073"` |
| Recharts tooltip `background: "#18181b"`, `border: "1px solid #27272a"` | `background: "#FFFFFF"`, `border: "1px solid #E6E1D5"` |
| Recharts série `stroke`/`fill: "#10b981"` | `"#0D6B5E"` |

États : focus ring émeraude (`focus:ring-halo/30 focus:border-halo`), erreur sur fond `bg-danger/10 border-danger/30 text-danger` (token danger optionnel — sinon garder rouge existant).

---

## Task 1: Ajouter les tokens HALO Light + capturer l'état « avant »

**Files:**
- Modify: `src/app/globals.css:20-29` (bloc `@theme`)

- [ ] **Step 1: Capturer les écrans « avant »**

Démarrer le serveur si besoin (`npm run dev`), puis capturer login + dashboard pour comparaison ultérieure (réutiliser le venv Playwright `/tmp/pw-venv`). Sauver dans `/tmp/cf-shots/before-login.png` et `/tmp/cf-shots/before-dashboard.png` (login démo `demo@walletcard.app` / `‹DEMO_PASSWORD›`).

- [ ] **Step 2: Ajouter les 3 tokens light**

Dans `src/app/globals.css`, à l'intérieur du bloc `@theme { ... }` existant (après `--color-halo-glow: #1FB89A;`), ajouter :

```css
  --color-surface: #FFFFFF;
  --color-line-warm: #E6E1D5;
  --color-galet-ink: #6E7073;
```

- [ ] **Step 3: Build pour vérifier que les utilitaires sont générés**

Run: `npm run build`
Expected: build OK, aucune erreur. (Les classes `bg-surface`, `border-line-warm`, `text-galet-ink` deviennent disponibles.)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): HALO Light tokens (surface, line-warm, galet-ink)"
```

---

## Task 2: Login en HALO Light

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Remplacer le rendu (JSX) par la version claire**

Remplacer l'import d'icônes ligne 6 et tout le bloc `return (...)` (lignes 43-127). Conserver toute la logique (`handleLogin`, états). Nouveau code :

Ligne 6 — remplacer `Wallet` par le HaloMark (retirer `Wallet` de l'import lucide) :
```tsx
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { HaloMark } from "@/components/halo/HaloMark";
```

Bloc `return` :
```tsx
  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <HaloMark size={44} className="mb-4" />
          <h1 className="font-display text-3xl tracking-[0.18em]">HALO</h1>
          <p className="text-galet-ink mt-2 font-display text-xl">
            Bon retour <em className="text-halo not-italic">parmi nous</em>
          </p>
        </div>

        <div className="bg-surface border border-line-warm rounded-3xl p-8 shadow-[0_8px_30px_-12px_rgba(14,15,17,0.18)]">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-galet-ink ml-1">Email professionnel</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                <input
                  required type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline px-1">
                <label className="text-sm font-medium text-galet-ink">Mot de passe</label>
                <Link href="#" className="text-xs text-galet hover:text-onyx transition-colors">Oublié ?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                <input
                  required type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-2xl text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              disabled={loading}
              className="w-full bg-halo text-white font-semibold py-4 rounded-2xl hover:bg-halo-600 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Se connecter <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <p className="text-center text-galet text-xs mt-8">
            Les comptes marchands sont créés par l&apos;administrateur.
          </p>
        </div>
      </motion.div>
    </div>
  );
```

- [ ] **Step 2: Vérifier l'API HaloMark**

Run: `sed -n '1,20p' src/components/halo/HaloMark.tsx`
Expected: confirmer que `HaloMark` accepte `size` et `className`. Si la prop diffère (ex. `ring`), adapter l'appel en conséquence.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS, aucune erreur TS/ESLint.

- [ ] **Step 4: Capture + vérif visuelle**

Capturer `http://localhost:3000/login` → `/tmp/cf-shots/after-login.png`. Vérifier : fond crème, carte blanche, logo HALO, titre serif, bouton émeraude, contraste lisible.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(design): HALO Light login (HaloMark, calcaire, emerald CTA)"
```

---

## Task 3: Shell du dashboard en HALO Light

**Files:**
- Modify: `src/app/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Remplacer la marque et appliquer la table de substitution**

Modifs précises :

1. Import (lignes 6-19) : retirer `Wallet` de lucide, ajouter `import { HaloMark } from "@/components/halo/HaloMark";`.
2. Conteneur racine (ligne 45) : `bg-zinc-950 text-white` → `bg-calcaire text-onyx`.
3. Sidebar desktop (ligne 48) : `border-zinc-900 bg-zinc-950` → `border-line-warm bg-[#EFEBE1]`.
4. Bloc logo (lignes 49-54) — remplacer par :
```tsx
        <div className="flex items-center gap-3 mb-12 px-2">
          <HaloMark size={32} />
          <span className="font-display text-xl tracking-[0.14em]">HALO</span>
        </div>
```
5. Lien de nav (lignes 63-71) : état actif `"bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"` → `"bg-halo text-white"` ; état inactif `"text-zinc-500 hover:text-white hover:bg-zinc-900"` → `"text-galet-ink hover:text-onyx hover:bg-[#E9E4D8]"`. Icône active `text-emerald-400` → `text-white` ; le point `bg-emerald-400` → `bg-white`.
6. Footer déconnexion (lignes 77-84) : `border-zinc-900` → `border-line-warm` ; `text-zinc-500 hover:text-red-400 hover:bg-red-400/5` → `text-galet-ink hover:text-red-600 hover:bg-red-500/10`.
7. Header mobile (ligne 89) : `border-zinc-900 bg-zinc-950/80` → `border-line-warm bg-calcaire/90` ; remplacer `<Wallet .../>` + `WalletCard` (lignes 91-92) par `<HaloMark size={22} /><span className="font-display tracking-[0.12em]">HALO</span>`.
8. Overlay mobile (ligne 106) : `bg-zinc-950` → `bg-calcaire` ; items (ligne 114) `bg-zinc-900/50 border-zinc-800` → `bg-surface border-line-warm` ; icône `text-emerald-400` → `text-halo` ; `text-zinc-600` → `text-galet`.
9. Main (ligne 136) : retirer le dégradé radial sombre, garder `bg-calcaire` (hérité). Remplacer la classe par `flex-1 h-screen overflow-y-auto lg:p-10 pt-24 p-6`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Capture + vérif**

Se connecter, capturer `/dashboard` → vérifier sidebar claire, logo HALO, item actif en pill émeraude plein.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/DashboardShell.tsx
git commit -m "feat(design): HALO Light dashboard shell (HaloMark nav, calcaire)"
```

---

## Task 4: Composant Card partagé + WidgetState

**Files:**
- Modify: `src/app/dashboard/_analytics/Card.tsx`

- [ ] **Step 1: Restyler Card et WidgetState**

Remplacer le contenu du fichier par :
```tsx
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-onyx mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function WidgetState({ loading, error, empty }: { loading?: boolean; error?: unknown; empty?: boolean }) {
  if (loading) return <div className="h-24 animate-pulse bg-[#ECE7DB] rounded-xl" />;
  if (error) return <div className="text-sm text-red-600">Erreur de chargement</div>;
  if (empty) return <div className="text-sm text-galet">Pas encore de données</div>;
  return null;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_analytics/Card.tsx
git commit -m "feat(design): HALO Light shared analytics Card"
```

---

## Task 5: KPIs + en-tête de la page Vue d'ensemble

**Files:**
- Modify: `src/app/dashboard/_analytics/widgets/KpisWidget.tsx:16-25`
- Modify: `src/app/dashboard/page.tsx:14-15`

- [ ] **Step 1: Restyler les tuiles KPI**

Dans `KpisWidget.tsx`, remplacer le `return (...)` (lignes 16-26) par :
```tsx
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface border border-line-warm rounded-3xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-galet-ink">{t.label}</div>
          <div className="text-2xl font-bold text-onyx">{t.value}</div>
          <div className="text-xs text-halo">{t.sub}</div>
        </div>
      ))}
    </div>
  );
```

- [ ] **Step 2: Restyler le titre/sous-titre de la page**

Dans `src/app/dashboard/page.tsx`, lignes 14-15 :
```tsx
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Bonjour, {merchant?.shop_name || "Commerçant"} 👋</h1>
        <p className="text-galet-ink">Voici l'activité de votre programme de fidélité.</p>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/_analytics/widgets/KpisWidget.tsx src/app/dashboard/page.tsx
git commit -m "feat(design): HALO Light KPI tiles + overview header"
```

---

## Task 6: Couleurs Recharts des widgets (light)

**Files (appliquer la table de substitution Recharts à chacun) :**
- Modify: `src/app/dashboard/_analytics/widgets/VisitsWidget.tsx:17-20`
- Modify: `src/app/dashboard/_analytics/widgets/AcquisitionWidget.tsx`
- Modify: `src/app/dashboard/_analytics/widgets/PeakHoursWidget.tsx`
- Modify: `src/app/dashboard/_analytics/widgets/RetentionWidget.tsx`
- Modify: `src/app/dashboard/_analytics/widgets/RewardsWidget.tsx`
- Modify: `src/app/dashboard/_analytics/widgets/TopCustomersWidget.tsx`
- Modify: `src/app/dashboard/_analytics/widgets/WalletMixWidget.tsx`

- [ ] **Step 1: Exemple complet — VisitsWidget**

Dans `VisitsWidget.tsx`, lignes 17-20, appliquer :
```tsx
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6E7073" }} hide={data.length > 14} />
              <YAxis tick={{ fontSize: 10, fill: "#6E7073" }} width={28} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E6E1D5", borderRadius: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#0D6B5E" strokeWidth={2} dot={false} />
```

- [ ] **Step 2: Appliquer la même substitution aux 6 autres widgets**

Pour chaque fichier listé : lire le fichier, puis remplacer mécaniquement, partout où ils apparaissent :
- `#71717a` ou `#a1a1aa` (ticks/axes zinc) → `#6E7073`
- tooltip `background: "#18181b"` → `"#FFFFFF"` et `border: "...#27272a"` → `"1px solid #E6E1D5"`
- séries `#10b981` (emerald-500) → `#0D6B5E` ; pour une 2e série/segment « inactif » (souvent un gris/zinc comme `#3f3f46`) → `#C4C6C8` (galet clair)
- toute classe Tailwind sombre résiduelle (`text-zinc-*`, `bg-zinc-*`, `border-zinc-*`) → équivalents de la table de substitution principale.

Vérifier `grep -rn "zinc\|#18181b\|#27272a\|#10b981\|#71717a" src/app/dashboard/_analytics/` ne renvoie plus rien après ce passage.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Capture + vérif**

Capturer `/dashboard` → `/tmp/cf-shots/after-dashboard.png`. Vérifier que tous les graphiques sont en émeraude sur fond clair, axes lisibles (galet), donut actifs émeraude / inactifs galet clair.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_analytics/widgets/
git commit -m "feat(design): HALO Light Recharts palette across widgets"
```

---

## Task 7: Vérification finale

- [ ] **Step 1: Recherche de résidus sombres**

Run: `grep -rn "zinc-\|bg-white text-black\|WalletCard\|text-emerald-400" src/app/login src/app/dashboard/DashboardShell.tsx src/app/dashboard/page.tsx src/app/dashboard/_analytics/`
Expected: aucun résultat (hors faux positifs commentés). Corriger les restes.

- [ ] **Step 2: Build complet**

Run: `npm run build`
Expected: PASS, 0 erreur.

- [ ] **Step 3: Vérif visuelle avant/après**

Comparer `/tmp/cf-shots/before-*.png` et `after-*.png`. Vérifier : login + dashboard cohérents HALO Light, marque HALO partout, contraste WCAG OK (texte onyx sur clair, CTA émeraude). Vérifier que **la landing `/` reste sombre** (non régressée).

- [ ] **Step 4: Vérif OS dark mode**

Forcer `prefers-color-scheme: dark` (Playwright `color_scheme="dark"`) sur `/login` et `/dashboard` → le fond doit rester calcaire (pas de bascule sombre via le `body`). Si bascule constatée, poser un fond explicite `bg-calcaire` sur le conteneur concerné.

- [ ] **Step 5: Commit final éventuel**

```bash
git add -A src/app/login src/app/dashboard
git commit -m "fix(design): HALO Light Lot 1 final polish"
```

---

## Notes d'exécution

- **Ne pas toucher** : `src/app/page.tsx` (landing) ni `src/components/landing/*` ; le WIP encaissement (`customers/RedeemCell.tsx`, `customers/page.tsx`) est hors périmètre.
- Token `danger` non créé : on garde les rouges Tailwind (`red-500/600`) pour les erreurs — suffisant pour le Lot 1.
- Si `HaloMark` n'expose pas `size`/`className` comme supposé, adapter les appels (vérifié en Task 2 Step 2).
