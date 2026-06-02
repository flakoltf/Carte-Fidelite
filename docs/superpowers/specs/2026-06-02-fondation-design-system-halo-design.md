# Fondation — Design System HALO (nouvelle direction artistique)

> **Statut :** spec validée (DA approuvée en brainstorming visuel), implémentation lancée.
> **Date :** 2026-06-02 · **Branche :** `design/refonte-ui`
> **Sous-projet :** F — Fondation design & grammaire de mouvement (1er des 5 sous-projets).

---

## 1. Contexte

HALO est une plateforme SaaS de cartes de fidélité 100 % digitales (Apple/Google Wallet, sans appli) pour les commerces de proximité de Suisse romande. Le produit existe déjà : landing, espace client (`/enroll`), dashboard commerçant (`/dashboard` + analytics), super-admin (`/admin`), génération de pass Apple/Google.

**Stack :** Next.js 16 (App Router) · React 19 · Tailwind v4 (`@theme` dans `globals.css`) · framer-motion 12 · lucide-react · recharts.

Le brief « expérience de fidélité premium, fluide et magique » demande de hisser tout le produit à un niveau premium. C'est trop vaste pour une seule spec → **découpage en 5 sous-projets** : **F** (cette spec), puis **B** espace client, **A** carte Wallet, **C** espace commerçant, **D** super-admin. Chaque sous-projet a son cycle spec → plan → implémentation.

La marque **HALO reste**. Décision prise en brainstorming : **garder le nom, faire évoluer la direction artistique**.

## 2. Décision de direction artistique (sortie du brainstorming visuel)

Ambiance retenue : **A1 « Précision suisse », version contrastée — claire & premium.**

- **Tons clairs** (ivoire/encre), pas de fond sombre. **Mode clair uniquement** pour l'instant (le dark mode est explicitement hors périmètre, à rajouter plus tard si besoin).
- Inspirations : école graphique suisse / Poinz / On (grille stricte, hairlines, hiérarchie typo forte) + SaaS US (Stripe, Mercury) pour la confiance.
- **Typographie :** titres & marque en **Newsreader** (serif raffiné, italique pour l'emphase) ; corps/UI/labels en **Inter**. La police mono (Geist Mono) est conservée pour les données/chiffres techniques.
- **Émeraude** conservée comme accent de marque, désormais posée sur fond clair.

### Palette (tokens primitifs)

| Rôle | Nom | Hex |
|------|-----|-----|
| Fond | Ivoire | `#F4F1E9` |
| Surface (cartes) | Surface | `#FFFFFF` |
| Surface 2 (sections) | Ivoire clair | `#FBF9F3` |
| Texte / encre | Encre | `#14150F` |
| Accent primaire | Émeraude | `#0D6B5E` |
| Émeraude foncée (hover/pressed) | Émeraude 600 | `#0A574C` |
| Glow (halo, focus) | Glow | `#1FB89A` |
| Accent secondaire (discret) | Or | `#C9A56B` |
| Texte atténué / muted | Galet | `#8A8A82` |
| Filets / lignes | Line | `rgba(20,21,15,.14)` |

> Contraste vérifié : encre `#14150F` sur ivoire `#F4F1E9` ≈ 15:1 (AAA). Émeraude `#0D6B5E` sur ivoire ≈ 4.7:1 (AA pour texte normal, OK boutons). Galet `#8A8A82` réservé au texte secondaire ≥ 16px / labels.

## 3. Périmètre

**Dans le périmètre (F) :**
1. **Architecture de tokens** à 3 niveaux (primitif → sémantique → composant) dans `globals.css` `@theme`.
2. **Bascule typographique** : Newsreader (display) + Inter (corps) via `next/font`, retrait de Fraunces.
3. **Grammaire de mouvement** : tokens de durée/easing, helpers framer-motion (Reveal, Stagger, Press), respect de `prefers-reduced-motion`, primitive de célébration (confettis sobres).
4. **Composants de base** réutilisables : Button, Card, Chip/Badge, Skeleton, Toast, Field (input + label + erreur), Hairline/Divider, SectionHeading.
5. **Style de référence de la carte de fidélité** (objet héros) appliqué au composant `LoyaltyCard` existant.
6. **Preuve d'intégration** : application de la nouvelle DA à la **landing** (`page.tsx`) — hero + galerie — pour valider la fondation en réel.

**Hors périmètre (sous-projets ultérieurs) :**
- Dark mode.
- Refonte complète des surfaces B (client/suivi), C (dashboard/éditeur WYSIWYG), D (admin) — seuls leurs styles hériteront de la fondation.
- Le pass Wallet réel (fichiers `.pkpass` / Google) — couvert par sous-projet A ; ici on ne touche qu'à l'aperçu web de la carte.
- Génération d'illustrations/3D IA (optionnel, plus tard).

## 4. Approches considérées

**A. Tokens-first sur Tailwind v4 `@theme` + primitives maison + couche framer-motion. ✅ RETENUE**
On étend le `@theme` existant (déjà le pattern du projet), on définit des tokens sémantiques, et on écrit un petit jeu de composants primitifs + une config de mouvement. Migration incrémentale, surface par surface.
*Pour :* colle au code existant (MASTER.md, `@theme`, framer-motion déjà là), risque minimal, valeur rapide, pas de nouvelle dépendance lourde. *Contre :* on écrit nos primitives (mais elles sont peu nombreuses et sur-mesure = plus premium).

**B. Adoption de shadcn/ui (Radix + Tailwind) thématisé HALO.**
*Pour :* composants accessibles complexes prêts (Dialog, Dropdown, Popover…). *Contre :* effort de re-styling pour éviter le « look shadcn générique », surface de dépendances, et la plupart des composants complexes ne sont pas nécessaires pour la fondation.

**C. Package design-system dédié + Storybook.**
*Pour :* le plus scalable/documenté. *Contre :* le plus lourd, lent à la 1re valeur, sur-dimensionné à ce stade (YAGNI).

**Décision :** **A**, avec la porte ouverte à piocher **ponctuellement** dans shadcn/Radix pour les composants accessibles complexes (Dialog, Combobox…) lors des sous-projets C/D — pas maintenant.

## 5. Conception détaillée

### 5.1 Architecture de tokens (3 niveaux)

- **Primitifs** (`@theme`) : couleurs brutes (ci-dessus), échelle d'espacement (4/8), rayons, ombres, durées/easings.
- **Sémantiques** (variables CSS sur `:root`) : `--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--primary`, `--primary-strong`, `--accent`, `--line`, `--focus`. Les composants n'utilisent **que** ces tokens sémantiques (jamais les hex bruts).
- **Composant** : exposés par les composants React (props/variants), jamais de hex en dur dans le JSX.

Échelles :
- **Espacement :** 4 8 12 16 24 32 48 64 96 (système 4/8).
- **Rayons :** `--r-sm 8px`, `--r-md 12px`, `--r-lg 16px`, `--r-xl 20px`, `--r-pill 999px`.
- **Ombres :** `--shadow-sm`, `--shadow-md`, `--shadow-lg` (douces, teintées encre, jamais noires pures), `--shadow-emerald` (pour CTA/carte).
- **Type scale :** 11 12 13 15 18 22 28 36 48 (px). Line-height corps 1.5, titres 1.05–1.1.

### 5.2 Typographie

- `next/font/google` : **Newsreader** (`--font-display`, axes optiques + italique) et **Inter** (`--font-sans`). Conserver **Geist Mono** (`--font-mono`) pour chiffres/données.
- Retirer **Fraunces** de `layout.tsx` et remapper `--font-display` → Newsreader dans `globals.css`.
- `font-display: swap`, préchargement des poids critiques uniquement (Newsreader 400/500, Inter 400/500/600).
- Utilitaires : `font-display` (Newsreader), `font-sans` (Inter), `font-mono`.

### 5.3 Grammaire de mouvement

- **Tokens :** durées `--dur-fast 150ms`, `--dur-base 220ms`, `--dur-slow 320ms` ; easings `--ease-out` (entrée), `--ease-in` (sortie), `--ease-spring` (framer spring pour interactions tactiles). Sortie ≈ 60–70 % de l'entrée.
- **Principes :** uniquement `transform`/`opacity` ; 1–2 éléments animés par vue ; le mouvement exprime une cause→effet (jamais décoratif seul).
- **Helpers framer-motion** (dans `src/components/motion/`) :
  - `<Reveal>` — apparition au scroll (fade + translateY léger), `viewport once`.
  - `<Stagger>` / `<StaggerItem>` — séquence 30–50 ms/item.
  - `<Press>` — scale 0.97 au tap/clic pour cartes & boutons.
  - `useHaloMotion()` / garde `prefers-reduced-motion` (framer `useReducedMotion` + garde CSS) : désactive holo/sheen/parallaxe et réduit les transitions.
  - `<Celebrate>` — confettis sobres (canvas léger, émeraude/or) déclenché sur succès (ajout carte, récompense) ; respecte reduced-motion (remplacé par un check statique).
- **États de chargement :** `<Skeleton>` (shimmer doux) plutôt que spinner pour > 300 ms ; jamais d'écran blanc.

### 5.4 Composants de base (`src/components/ui/`)

Chacun : tokens sémantiques only, focus ring visible (`--focus`), cibles ≥ 44px, états hover/pressed/disabled distincts, `cursor-pointer` sur cliquables.

- **Button** — variants `primary` (émeraude plein), `solid` (encre), `ghost` (bord encre), `link` ; tailles sm/md/lg ; état loading (spinner + disabled).
- **Card** — surface blanche, hairline, ombre douce ; sous-variantes `flat` / `elevated`.
- **Chip / Badge** — pastille émeraude discrète (`★ Sans appli`), statut.
- **Field** — label visible (jamais placeholder-only), helper, erreur sous le champ, validation au blur, types sémantiques (email/tel), focus auto sur 1re erreur.
- **Toast** — `aria-live="polite"`, auto-dismiss 3–5 s, ne vole pas le focus.
- **Skeleton** — blocs/shimmer aux tokens.
- **Divider / Hairline** — filet `--line`.
- **SectionHeading** — eyebrow (label émeraude) + titre Newsreader + sous-titre.
- **Wordmark HALO** — « HAL » + cercle (le « halo » = le O), en Newsreader 500.

### 5.5 La carte de fidélité (objet héros — style de référence)

Appliqué au `LoyaltyCard` existant : surface blanche, **hairline** de contour, **filet émeraude** vertical en accent, nom du commerçant en **Newsreader**, type en label Inter, tampons/jauge en émeraude (glow discret), QR encadré. Variantes par couleur de commerçant via tokens (accent override). Effet holographique conservé **très subtil** et **désactivé sous reduced-motion**.

> Note : une version premium du `LoyaltyCard` (profondeur, contactless, grain, `tabular-nums`) a déjà été prototypée et reste en attente dans la copie de travail `~/Desktop` (non commitée). À réconcilier lors de l'implémentation.

### 5.6 Structure de fichiers

```
src/app/globals.css        # tokens @theme (primitifs + sémantiques + motion), light-only
src/app/layout.tsx         # next/font: Newsreader + Inter + Geist Mono
src/components/ui/          # Button, Card, Chip, Field, Toast, Skeleton, Divider, SectionHeading, Wordmark
src/components/motion/      # Reveal, Stagger, Press, Celebrate, useHaloMotion
src/components/landing/     # LoyaltyCard (restyle) + application DA à la landing
design-system/MASTER.md     # mis à jour : nouvelle DA (clair, Newsreader), tokens, scope guard
```

### 5.7 Garde-fou de scope & migration

- Migration **incrémentale** : la fondation + la **landing** d'abord (preuve). Les surfaces dashboard/admin/scan/login/api ne sont **pas** retouchées dans ce sous-projet (elles héritent des tokens, restyle dans leurs sous-projets dédiés).
- Mettre à jour `design-system/MASTER.md` pour refléter la nouvelle DA claire (remplacer la section « Brand locked » sombre).

## 6. Qualité (non négociable)

- **Accessibilité :** contraste AA (paires vérifiées §2), focus visible, nav clavier, cibles ≥ 44px, `prefers-reduced-motion` respecté partout, labels de formulaire.
- **Performance :** animations 60 fps (`transform`/`opacity`), `font-display: swap`, lazy-load des visuels lourds, pas de CLS (réserver l'espace, `aspect-ratio`).
- **Cohérence :** un seul jeu de tokens réutilisé ; aucun hex en dur dans les composants.
- **Localisation :** FR (Suisse romande), prêt i18n ultérieur.

## 7. Critères de réussite

- La landing rend avec la nouvelle DA claire (ivoire/encre/émeraude, Newsreader) sans régression de build.
- `globals.css` expose des tokens sémantiques ; les nouveaux composants n'utilisent que ceux-ci.
- Les primitives de mouvement fonctionnent et se neutralisent sous `prefers-reduced-motion`.
- `npm run build` passe (types + lint).
- La carte de fidélité reflète le style de référence.

## 8. Risques & décisions ouvertes

- **Deux copies du repo** : `~/Projects` (exécutable, branche `design/refonte-ui`) = copie de travail ; `~/Desktop` (iCloud) contient un restyle `LoyaltyCard` non commité à réconcilier. **Travailler dans `~/Projects`.**
- **Dépendances** : confirmer que `node_modules` de cette branche build (sinon `npm install`).
- **Newsreader vs Fraunces** : vérifier le rendu des titres existants après bascule (tailles/poids).
- **Contraste émeraude/ivoire** sur petits textes : réserver l'émeraude aux accents/boutons, pas au corps.

## 9. Suite

Sous-projet F implémenté → puis **B (espace client : scan → ajout Wallet « magique » → suivi)**, qui exploite le plus la grammaire de mouvement. Chaque surface suivante = sa propre spec.
