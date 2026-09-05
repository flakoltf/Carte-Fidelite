# Tests E2E — parcours marchand COMPTOIR (Playwright)

Filet de sécurité avant la prod : on teste le geste central du comptoir
(scanner → créditer → offrir) bout en bout, sur viewport mobile (iPhone 13,
moteur chromium). **Localhost uniquement — jamais contre la prod.**

## Lancer

```bash
# Mot de passe du compte démo « Café du Rhône » — JAMAIS committé.
export E2E_MERCHANT_EMAIL=demo@example.com      # défaut si omis
export E2E_MERCHANT_PASSWORD='…'                # obligatoire (cf. COMPTES-DEMO.md, hors repo)

npm run test:e2e          # tout (démarre `npm run dev` avec NEXT_PUBLIC_E2E=1)
npm run test:e2e:ui       # mode UI interactif
```

Playwright démarre lui-même le serveur (`npm run dev`) avec `NEXT_PUBLIC_E2E=1`.
En local, un `npm run dev` déjà lancé est réutilisé **à condition** qu'il ait été
démarré avec ce flag (sinon les seams sont inertes → specs en échec).

## Architecture

| Fichier | Rôle |
|---|---|
| `playwright.config.ts` | projet `setup` (login) → projet `Mobile Safari` (specs) ; fausse caméra ; webServer `NEXT_PUBLIC_E2E=1` |
| `auth.setup.ts` | login réel Café du Rhône → `storageState` réutilisé (cookies sb-* + signal local « guide masqué ») |
| `fixtures.ts` | fixture `scanApi` : mocks `/api/scan` & `/api/scan/redeem` + **filet anti-écriture-prod** |
| `comptoir-stamp.spec.ts` | E2E-2 — carte à tampons (stamp_card) |
| `comptoir-amount-points.spec.ts` | E2E-3 — points au montant (amount_points) |
| `comptoir-reward.spec.ts` | E2E-4 — récompense (OFFRIR) |
| `dashboard-scroll.spec.ts` | régression « espace mort défilable / fond noir » (dashboard) |
| `admin.setup.ts` | login admin (compte démo admin) → `storageState` admin — **skip** sans `E2E_ADMIN_PASSWORD` |
| `admin-scroll.spec.ts` | même régression côté back-office (projet `Admin`, `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_MERCHANT_ID` facultatif) |

## Les SEAMS de test (gated `NEXT_PUBLIC_E2E === "1"`)

Deux seams **minimaux** rendent le parcours pilotable sans caméra ni marchand
amount_points réel. Ils vivent dans 2 fichiers prod et sont **inertes en prod** :

> ⚠️ `NEXT_PUBLIC_E2E` est un flag `NEXT_PUBLIC_` inliné au build (comme un DSN
> Sentry). Il **ne doit JAMAIS être posé sur le projet Vercel de prod** : absent
> en prod ⇒ les deux seams sont du **code mort**. Ne l'ajoutez qu'aux runs E2E.

1. **`window.__e2eDecode(cardId)`** — `ComptoirScan.tsx`. Expose le déclencheur de
   décodage QR sur `window` (nettoyé au démontage). Permet à Playwright de simuler
   un scan sans vraie caméra. Le crédit réel passe toujours par `/api/scan` (mocké).
2. **`?e2eProgram=amount_points`** — `scan/page.tsx`. Override **d'affichage seul**
   de la prop `programType` passée à `<ComptoirScan>` (pour tester le pavé CHF sans
   marchand amount_points réel). N'altère **jamais** la résolution serveur du
   crédit : `/api/scan` lit toujours le programme réel du marchand.

La garde anti-régression `…/scan/_components/__tests__/e2eSeams.test.tsx` (vitest)
vérifie qu'avec le flag absent, `window.__e2eDecode` reste `undefined` et l'override
est ignoré — pour ne jamais expédier un seam vivant.

## Filet anti-écriture-prod (critique)

La fixture `scanApi` intercepte **toute** requête `/api/scan*`, `/api/scan/redeem*`,
`/api/redeem*` :

- si le test a fourni un mock (`scanApi.mockScan(...)` / `mockRedeem(...)`) → réponse simulée ;
- sinon → la requête est **coupée** et le test **échoue** en fin de run.

Un mock oublié ne peut donc jamais écrire dans la Supabase de prod. Le login
(`/api/auth/login`) et le chargement des pages ne font que **lire** : zéro
écriture loyalty en prod.
