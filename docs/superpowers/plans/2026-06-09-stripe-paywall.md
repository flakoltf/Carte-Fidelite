# Page de paiement Stripe (self-service, débranchée) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la chaîne d'achat self-service (Stripe Checkout → webhook → création de compte + email lien sécurisé → définition du mot de passe), entièrement testable et **débranchée** (flag d'env) tant que le compte Stripe n'existe pas.

**Architecture:** Stripe Checkout hébergé pour le paiement ; un webhook `checkout.session.completed` déclenche le provisioning (Supabase Auth + fiche merchant) et l'email d'invitation Resend ; un flag `isStripeEnabled()` neutralise tout tant que les clés manquent.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (service role + Auth admin), Stripe Node SDK, Resend, Vitest.

> ⚠️ **Toujours utiliser Node 22 / npm 10 pour toute opération npm** (`nvm use 22`) — sinon le `package-lock.json` se désynchronise et le CI casse (cf. incident du 2026-06-08). La migration DB est **appliquée par l'utilisateur** (jamais en direct par l'agent).

---

## Structure des fichiers

**À créer :**
- `supabase/migrations/20260609_merchant_billing.sql` — colonnes abonnement sur `merchants`
- `src/lib/billing/plans.ts` — config des 3 plans (source de vérité)
- `src/lib/billing/__tests__/plans.test.ts`
- `src/lib/billing/stripe.ts` — client Stripe + `isStripeEnabled()`
- `src/lib/billing/provision.ts` — provisioning idempotent + envoi email
- `src/lib/billing/__tests__/provision.test.ts`
- `src/lib/billing/events.ts` — `handleStripeEvent(event)` (logique testable)
- `src/lib/billing/__tests__/events.test.ts`
- `src/lib/email/templates/invite.ts` — email d'invitation brandé
- `src/app/api/checkout/route.ts` — création de la Checkout Session
- `src/app/api/webhooks/stripe/route.ts` — réception + vérif signature
- `src/app/(app)/definir-mot-de-passe/page.tsx` + `SetPasswordClient.tsx`
- `src/app/(marketing)/abonnement/merci/page.tsx`

**À modifier :**
- `package.json` — ajout dépendance `stripe`
- `src/app/(marketing)/page.tsx` — nouveaux plans + boutons câblés / état « Bientôt »
- `src/proxy.ts` — exclure `api/webhooks` du matcher
- `.env.example` — section Stripe

---

## Task 1 : Migration DB — colonnes abonnement sur `merchants`

**Files:**
- Create: `supabase/migrations/20260609_merchant_billing.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Champs d'abonnement Stripe sur merchants (additif, non destructif).
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS card_limit INT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- Idempotence du provisioning : un client Stripe = au plus une fiche.
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_stripe_customer
  ON merchants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

- [ ] **Step 2 : Demander à l'utilisateur d'appliquer la migration**

Ne PAS l'appliquer en direct. Message à l'utilisateur :
> Migration `20260609_merchant_billing.sql` prête. Applique-la via Supabase SQL Editor (projet WalletCard) en collant le contenu du fichier, puis confirme.

Attendre confirmation avant de continuer les tâches qui lisent ces colonnes (Task 5+). Les tâches 2-4 ne dépendent pas de la DB.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260609_merchant_billing.sql
git commit -m "feat(billing): migration colonnes abonnement sur merchants"
```

---

## Task 2 : Config des plans (source de vérité) + tests

**Files:**
- Create: `src/lib/billing/plans.ts`
- Test: `src/lib/billing/__tests__/plans.test.ts`

- [ ] **Step 1 : Écrire le test d'abord**

```ts
// src/lib/billing/__tests__/plans.test.ts
import { describe, it, expect } from "vitest";
import { PLANS, PLAN_KEYS, getPlan, cardLimitForPlan } from "@/lib/billing/plans";

describe("plans", () => {
  it("expose 3 plans dans l'ordre", () => {
    expect(PLAN_KEYS).toEqual(["starter", "pro", "business"]);
  });
  it("a les bons prix et limites de cartes", () => {
    expect(PLANS.starter.priceChf).toBe(69);
    expect(PLANS.starter.cardLimit).toBe(250);
    expect(PLANS.pro.priceChf).toBe(129);
    expect(PLANS.pro.cardLimit).toBe(1000);
    expect(PLANS.business.priceChf).toBe(199);
    expect(PLANS.business.cardLimit).toBe(3000);
  });
  it("getPlan renvoie le plan ou null", () => {
    expect(getPlan("pro")?.label).toBe("Pro");
    expect(getPlan("inconnu")).toBeNull();
  });
  it("cardLimitForPlan mappe correctement", () => {
    expect(cardLimitForPlan("business")).toBe(3000);
    expect(cardLimitForPlan("inconnu")).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run src/lib/billing/__tests__/plans.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `plans.ts`**

```ts
// src/lib/billing/plans.ts
// Source de vérité des plans d'abonnement HaloCard. Utilisée par la vitrine,
// le checkout et le provisioning. Les Price IDs Stripe viennent de l'env.
export const PLAN_KEYS = ["starter", "pro", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type Plan = {
  key: PlanKey;
  label: string;
  priceChf: number;
  cardLimit: number;
  tagline: string;
  featured: boolean;
  stripePriceIdEnv: string; // nom de la variable d'env contenant le Price ID
};

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter", label: "Starter", priceChf: 69, cardLimit: 250,
    tagline: "Jusqu'à 250 cartes actives", featured: false,
    stripePriceIdEnv: "STRIPE_PRICE_STARTER",
  },
  pro: {
    key: "pro", label: "Pro", priceChf: 129, cardLimit: 1000,
    tagline: "Jusqu'à 1 000 cartes actives", featured: true,
    stripePriceIdEnv: "STRIPE_PRICE_PRO",
  },
  business: {
    key: "business", label: "Business", priceChf: 199, cardLimit: 3000,
    tagline: "Jusqu'à 3 000 cartes actives", featured: false,
    stripePriceIdEnv: "STRIPE_PRICE_BUSINESS",
  },
};

export function getPlan(key: string): Plan | null {
  return (PLAN_KEYS as readonly string[]).includes(key) ? PLANS[key as PlanKey] : null;
}

export function cardLimitForPlan(key: string): number | null {
  return getPlan(key)?.cardLimit ?? null;
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npx vitest run src/lib/billing/__tests__/plans.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/billing/plans.ts src/lib/billing/__tests__/plans.test.ts
git commit -m "feat(billing): config source-de-vérité des plans + tests"
```

---

## Task 3 : Dépendance Stripe + client + `isStripeEnabled()`

**Files:**
- Modify: `package.json` (+ `package-lock.json` régénéré)
- Create: `src/lib/billing/stripe.ts`

- [ ] **Step 1 : Installer le SDK Stripe sous Node 22**

```bash
nvm use 22
npm install stripe --no-audit --no-fund
```
Expected: `stripe` ajouté à `dependencies`, `package-lock.json` mis à jour (npm 10).

- [ ] **Step 2 : Implémenter `stripe.ts`**

```ts
// src/lib/billing/stripe.ts
import Stripe from "stripe";
import { PLANS, PLAN_KEYS, type PlanKey } from "./plans";

// Stripe n'est "actif" que si la clé secrète ET les 3 Price IDs sont présents.
export function isStripeEnabled(): boolean {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  return PLAN_KEYS.every((k) => !!process.env[PLANS[k].stripePriceIdEnv]);
}

export function priceIdForPlan(key: PlanKey): string | null {
  return process.env[PLANS[key].stripePriceIdEnv] ?? null;
}

let _stripe: Stripe | null = null;
// Client paresseux : ne crée rien si la clé manque (build/preview sans Stripe).
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquant");
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}
```

- [ ] **Step 3 : Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json src/lib/billing/stripe.ts
git commit -m "feat(billing): SDK Stripe + client paresseux + isStripeEnabled()"
```

---

## Task 4 : Email d'invitation brandé (Resend)

**Files:**
- Create: `src/lib/email/templates/invite.ts`

> Vérifier d'abord le module d'envoi existant : lire `src/lib/email/send.ts` et `src/lib/email/templates.ts` pour réutiliser la fonction d'envoi (`sendEmail`) et le style des templates. Adapter les noms ci-dessous à l'API réelle observée.

- [ ] **Step 1 : Implémenter le template + helper d'envoi**

```ts
// src/lib/email/templates/invite.ts
import { sendEmail } from "@/lib/email/send"; // adapter au nom réel exporté

export async function sendMerchantInviteEmail(params: {
  to: string;
  shopName: string;
  actionLink: string; // lien sécurisé Supabase (definir-mot-de-passe)
}): Promise<void> {
  const { to, shopName, actionLink } = params;
  const subject = "Bienvenue sur HaloCard — activez votre compte";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h1 style="color:#0D6B5E">Bienvenue sur HaloCard 🎉</h1>
      <p>Votre abonnement pour <strong>${shopName}</strong> est actif.</p>
      <p>Cliquez ci-dessous pour <strong>activer votre compte</strong> et définir votre mot de passe :</p>
      <p><a href="${actionLink}"
            style="display:inline-block;background:#0D6B5E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
            Activer mon compte</a></p>
      <p style="color:#888;font-size:13px">Ce lien est personnel et à usage unique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>`;
  await sendEmail({ to, subject, html });
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur (corriger l'import `sendEmail` selon l'API réelle si besoin).

- [ ] **Step 3 : Commit**

```bash
git add src/lib/email/templates/invite.ts
git commit -m "feat(billing): email d'invitation commerçant brandé (Resend)"
```

---

## Task 5 : Provisioning idempotent + tests

**Files:**
- Create: `src/lib/billing/provision.ts`
- Test: `src/lib/billing/__tests__/provision.test.ts`

**Dépend de la Task 1 appliquée en DB.** Le provisioning : (a) cherche un user Auth par email ; (b) le crée si absent ; (c) upsert la fiche `merchants` (plan, card_limit, IDs Stripe, statut) ; (d) génère un lien sécurisé Supabase et envoie l'email. Idempotent via `stripe_customer_id`.

- [ ] **Step 1 : Écrire le test (dépendances injectées pour testabilité)**

```ts
// src/lib/billing/__tests__/provision.test.ts
import { describe, it, expect, vi } from "vitest";
import { provisionMerchant } from "@/lib/billing/provision";

function makeDeps() {
  const merchantsByCustomer = new Map<string, { id: string }>();
  const deps = {
    findUserByEmail: vi.fn(async () => null),
    createUser: vi.fn(async (_email: string) => ({ id: "user-1" })),
    upsertMerchant: vi.fn(async (row: { stripe_customer_id: string }) => {
      const existing = merchantsByCustomer.get(row.stripe_customer_id);
      const m = existing ?? { id: "merch-1" };
      merchantsByCustomer.set(row.stripe_customer_id, m);
      return { id: m.id, shop_name: "Boutique" };
    }),
    generateInviteLink: vi.fn(async () => "https://link.example/invite"),
    sendInviteEmail: vi.fn(async () => {}),
  };
  return deps;
}

describe("provisionMerchant", () => {
  it("crée user + merchant + envoie l'email d'invitation", async () => {
    const deps = makeDeps();
    await provisionMerchant(
      { email: "m@shop.ch", plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
      deps,
    );
    expect(deps.createUser).toHaveBeenCalledWith("m@shop.ch");
    expect(deps.upsertMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", card_limit: 1000, stripe_customer_id: "cus_1" }),
    );
    expect(deps.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "m@shop.ch", actionLink: "https://link.example/invite" }),
    );
  });

  it("ne recrée pas l'utilisateur s'il existe déjà (idempotent)", async () => {
    const deps = makeDeps();
    deps.findUserByEmail = vi.fn(async () => ({ id: "user-existant" }));
    await provisionMerchant(
      { email: "m@shop.ch", plan: "starter", stripeCustomerId: "cus_2", stripeSubscriptionId: "sub_2" },
      deps,
    );
    expect(deps.createUser).not.toHaveBeenCalled();
    expect(deps.upsertMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "starter", card_limit: 250 }),
    );
  });

  it("rejette un plan inconnu", async () => {
    const deps = makeDeps();
    await expect(
      provisionMerchant(
        { email: "m@shop.ch", plan: "inconnu", stripeCustomerId: "c", stripeSubscriptionId: "s" },
        deps,
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run src/lib/billing/__tests__/provision.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `provision.ts`** (logique pure + adaptateurs Supabase réels)

```ts
// src/lib/billing/provision.ts
import { cardLimitForPlan } from "./plans";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMerchantInviteEmail } from "@/lib/email/templates/invite";

export type ProvisionInput = {
  email: string;
  plan: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

// Dépendances injectables (tests). En prod : adaptateurs Supabase ci-dessous.
export type ProvisionDeps = {
  findUserByEmail: (email: string) => Promise<{ id: string } | null>;
  createUser: (email: string) => Promise<{ id: string }>;
  upsertMerchant: (row: Record<string, unknown>) => Promise<{ id: string; shop_name: string }>;
  generateInviteLink: (email: string, userExists: boolean) => Promise<string>;
  sendInviteEmail: (p: { to: string; shopName: string; actionLink: string }) => Promise<void>;
};

export async function provisionMerchant(input: ProvisionInput, deps: ProvisionDeps): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const cardLimit = cardLimitForPlan(input.plan);
  if (cardLimit === null) throw new Error(`Plan inconnu: ${input.plan}`);

  const existing = await deps.findUserByEmail(email);
  const user = existing ?? (await deps.createUser(email));

  const merchant = await deps.upsertMerchant({
    user_id: user.id,
    email,
    // shop_name est NOT NULL : valeur par défaut dérivée de l'email, que le
    // commerçant pourra changer dans Réglages. Sur retry webhook (même
    // stripe_customer_id, quelques secondes plus tard, avant tout login), la
    // ré-écriture de cette valeur par défaut est bénigne.
    shop_name: email.split("@")[0],
    plan: input.plan,
    card_limit: cardLimit,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    subscription_status: "active",
  });

  const link = await deps.generateInviteLink(email, !!existing);
  await deps.sendInviteEmail({ to: email, shopName: merchant.shop_name, actionLink: link });
}

// Adaptateurs prod (non couverts par les tests unitaires ; vérifiés en intégration).
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://app.halocard.ch";

export function prodDeps(): ProvisionDeps {
  return {
    findUserByEmail: async (email) => {
      // Recherche paginée (API admin Supabase).
      for (let page = 1; ; page++) {
        const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        const u = data.users.find((x) => x.email?.toLowerCase() === email);
        if (u) return { id: u.id };
        if (data.users.length < 1000) return null;
      }
    },
    createUser: async (email) => {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: false });
      if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
      return { id: data.user.id };
    },
    upsertMerchant: async (row) => {
      const { data, error } = await supabaseAdmin
        .from("merchants")
        .upsert(row, { onConflict: "stripe_customer_id" })
        .select("id, shop_name")
        .single();
      if (error || !data) throw new Error(`upsertMerchant: ${error?.message}`);
      return data;
    },
    generateInviteLink: async (email, userExists) => {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: userExists ? "recovery" : "invite",
        email,
        options: { redirectTo: `${BASE_URL}/definir-mot-de-passe` },
      });
      if (error || !data.properties?.action_link) throw new Error(`generateLink: ${error?.message}`);
      return data.properties.action_link;
    },
    sendInviteEmail: sendMerchantInviteEmail,
  };
}
```

> Note : `upsertMerchant` suppose une fiche `merchants` créée/complétée ici. Si une fiche merchant doit exister AVANT (lien `user_id`), vérifier le flux de création existant dans `/api/admin/merchants` et aligner les colonnes obligatoires (`shop_name` est NOT NULL → fournir une valeur par défaut, ex. dérivée de l'email, modifiable ensuite par le commerçant).

- [ ] **Step 4 : Lancer les tests (doivent passer)**

Run: `npx vitest run src/lib/billing/__tests__/provision.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/billing/provision.ts src/lib/billing/__tests__/provision.test.ts
git commit -m "feat(billing): provisioning idempotent du commerçant + tests"
```

---

## Task 6 : Gestionnaire d'événements Stripe (logique testable) + tests

**Files:**
- Create: `src/lib/billing/events.ts`
- Test: `src/lib/billing/__tests__/events.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// src/lib/billing/__tests__/events.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent } from "@/lib/billing/events";

describe("handleStripeEvent", () => {
  it("provisionne sur checkout.session.completed", async () => {
    const provision = vi.fn(async () => {});
    const event = {
      type: "checkout.session.completed",
      data: { object: {
        customer: "cus_1", subscription: "sub_1",
        customer_details: { email: "m@shop.ch" },
        metadata: { plan: "pro" },
      } },
    };
    await handleStripeEvent(event as never, provision);
    expect(provision).toHaveBeenCalledWith({
      email: "m@shop.ch", plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1",
    });
  });

  it("ignore les autres types d'événements", async () => {
    const provision = vi.fn(async () => {});
    await handleStripeEvent({ type: "invoice.paid", data: { object: {} } } as never, provision);
    expect(provision).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run src/lib/billing/__tests__/events.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `events.ts`**

```ts
// src/lib/billing/events.ts
import type Stripe from "stripe";
import type { ProvisionInput } from "./provision";

type Provisioner = (input: ProvisionInput) => Promise<void>;

export async function handleStripeEvent(event: Stripe.Event, provision: Provisioner): Promise<void> {
  if (event.type !== "checkout.session.completed") return;
  const s = event.data.object as Stripe.Checkout.Session;
  const email = s.customer_details?.email;
  const plan = s.metadata?.plan;
  if (!email || !plan) throw new Error("Session sans email ou plan");
  await provision({
    email,
    plan,
    stripeCustomerId: String(s.customer),
    stripeSubscriptionId: String(s.subscription),
  });
}
```

- [ ] **Step 4 : Lancer les tests (doivent passer)**

Run: `npx vitest run src/lib/billing/__tests__/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/billing/events.ts src/lib/billing/__tests__/events.test.ts
git commit -m "feat(billing): handler d'événements Stripe testable + tests"
```

---

## Task 7 : Route webhook + exclusion du proxy

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`
- Modify: `src/proxy.ts` (matcher)

- [ ] **Step 1 : Exclure `api/webhooks` du proxy**

Dans `src/proxy.ts`, ajouter `api/webhooks` à la liste négative du matcher (à côté de `api/wallet`) :
```ts
matcher: ['/((?!_next/static|_next/image|favicon.ico|c/|enroll|api/enroll|api/wallet|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
```

- [ ] **Step 2 : Implémenter la route webhook**

```ts
// src/app/api/webhooks/stripe/route.ts
import { NextResponse } from "next/server";
import { getStripe, isStripeEnabled } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/events";
import { provisionMerchant, prodDeps } from "@/lib/billing/provision";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeEnabled()) return new NextResponse("Stripe désactivé", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("Signature manquante", { status: 400 });

  const body = await req.text(); // corps brut requis pour la vérification
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new NextResponse("Signature invalide", { status: 400 });
  }

  try {
    await handleStripeEvent(event, (input) => provisionMerchant(input, prodDeps()));
  } catch (err) {
    console.error("Webhook provisioning échoué:", err);
    return new NextResponse("Erreur de traitement", { status: 500 }); // Stripe relancera
  }
  return NextResponse.json({ received: true });
}
```

- [ ] **Step 3 : Typecheck + build + tests**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tout passe (la route construit même sans clés ; `isStripeEnabled()` renvoie false → 503).

- [ ] **Step 4 : Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts src/proxy.ts
git commit -m "feat(billing): route webhook Stripe (signée, exclue du proxy)"
```

---

## Task 8 : Route checkout

**Files:**
- Create: `src/app/api/checkout/route.ts`

- [ ] **Step 1 : Implémenter la route**

```ts
// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { getStripe, isStripeEnabled, priceIdForPlan } from "@/lib/billing/stripe";
import { getPlan } from "@/lib/billing/plans";

export const runtime = "nodejs";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://app.halocard.ch";

export async function POST(req: Request) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: "Paiement bientôt disponible" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const plan = getPlan(typeof body.plan === "string" ? body.plan : "");
  if (!plan) return NextResponse.json({ error: "Plan invalide" }, { status: 400 });

  const price = priceIdForPlan(plan.key);
  if (!price) return NextResponse.json({ error: "Prix non configuré" }, { status: 503 });

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    metadata: { plan: plan.key },
    subscription_data: { metadata: { plan: plan.key } },
    success_url: `${BASE_URL}/abonnement/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://halocard.ch/#tarifs`,
  });
  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2 : Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: passe.

- [ ] **Step 3 : Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat(billing): route checkout (Stripe Checkout Session)"
```

---

## Task 9 : Page de définition du mot de passe

**Files:**
- Create: `src/app/(app)/definir-mot-de-passe/page.tsx`
- Create: `src/app/(app)/definir-mot-de-passe/SetPasswordClient.tsx`

> Vérifier d'abord comment le client navigateur Supabase est créé (chercher `createBrowserClient` dans `src/`) et réutiliser le même helper. La page sert de cible `redirectTo` du lien : Supabase établit une session de récupération à l'arrivée.

- [ ] **Step 1 : Page serveur (coquille)**

```tsx
// src/app/(app)/definir-mot-de-passe/page.tsx
import SetPasswordClient from "./SetPasswordClient";
export const dynamic = "force-dynamic";
export default function Page() {
  return <SetPasswordClient />;
}
```

- [ ] **Step 2 : Composant client**

```tsx
// src/app/(app)/definir-mot-de-passe/SetPasswordClient.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr"; // aligner avec le helper existant

export default function SetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError("Lien expiré ou invalide. Demandez un nouveau lien via « mot de passe oublié »."); return; }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Définissez votre mot de passe</h1>
        <input type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe (min. 8 caractères)"
          className="w-full rounded-lg border px-3 py-2" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-halo text-white py-2 font-semibold disabled:opacity-50">
          {loading ? "…" : "Activer mon compte"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: passe ; route `/definir-mot-de-passe` listée.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(app)/definir-mot-de-passe"
git commit -m "feat(billing): page de définition du mot de passe (lien sécurisé)"
```

---

## Task 10 : Page de remerciement post-paiement

**Files:**
- Create: `src/app/(marketing)/abonnement/merci/page.tsx`

- [ ] **Step 1 : Implémenter la page**

```tsx
// src/app/(marketing)/abonnement/merci/page.tsx
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Merci — HaloCard" };

export default function MerciPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-bold text-halo">Merci pour votre abonnement 🎉</h1>
        <p className="mt-4 text-galet-ink">
          Un email vient de vous être envoyé pour <strong>activer votre compte</strong> et
          définir votre mot de passe. Pensez à vérifier vos spams.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Build + commit**

Run: `npm run build` (Expected: passe)
```bash
git add "src/app/(marketing)/abonnement/merci/page.tsx"
git commit -m "feat(billing): page de remerciement post-paiement"
```

---

## Task 11 : Mise à jour de la vitrine (nouveaux plans + boutons)

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

> Lire le fichier d'abord. Remplacer le tableau `PRICING` (ancien Essentiel/Croissance/Premium) en important depuis `@/lib/billing/plans`, et câbler les boutons « Choisir » sur un appel `POST /api/checkout`. Si la réponse est 503, afficher « Bientôt disponible ».

- [ ] **Step 1 : Remplacer les données de prix par la source de vérité**

Supprimer le tableau `PRICING` local et dériver l'affichage de `PLANS` (`@/lib/billing/plans`) : `label`, `priceChf` (afficher `${priceChf} CHF / mois`), `tagline`, `featured`. Conserver `PLAN_FEATURES`.

- [ ] **Step 2 : Câbler le bouton (composant client)**

Extraire un petit composant client `ChoosePlanButton` :
```tsx
"use client";
import { useState } from "react";
import type { PlanKey } from "@/lib/billing/plans";

export function ChoosePlanButton({ plan, label }: { plan: PlanKey; label: string }) {
  const [state, setState] = useState<"idle" | "loading" | "soon">("idle");
  async function go() {
    setState("loading");
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.status === 503) { setState("soon"); return; }
    const data = await res.json().catch(() => ({}));
    if (data.url) { window.location.href = data.url; return; }
    setState("idle");
  }
  if (state === "soon") return <span className="block text-center text-galet-ink py-3">Bientôt disponible</span>;
  return (
    <button onClick={go} disabled={state === "loading"}
      className="w-full rounded-xl bg-halo text-white py-3 font-bold disabled:opacity-50">
      {state === "loading" ? "…" : label}
    </button>
  );
}
```
Remplacer les liens `<a href="/signup">Choisir</a>` par `<ChoosePlanButton plan={plan.key} label="Choisir" />`.

- [ ] **Step 3 : Typecheck + build + lint**

Run: `nvm use 22 && npx tsc --noEmit && npm run lint && npm run build`
Expected: tout passe ; section tarifs affiche Starter/Pro/Business.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(billing): vitrine — nouveaux plans + boutons checkout"
```

---

## Task 12 : `.env.example` + vérification finale

**Files:**
- Modify: `.env.example`

- [ ] **Step 1 : Décommenter/compléter la section Stripe**

```bash
# ---- Stripe (abonnements) ----
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
```

- [ ] **Step 2 : Vérification complète comme le CI (Node 22)**

Run: `nvm use 22 && npm ci && npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: tout vert (le nouveau code est inerte tant que `isStripeEnabled()` est faux).

- [ ] **Step 3 : Commit**

```bash
git add .env.example
git commit -m "docs(billing): variables d'env Stripe dans .env.example"
```

---

## Mise en service (jour J, post-registre — hors de ce plan)
1. Créer le compte Stripe + 3 produits/prix récurrents (CHF mensuel).
2. Créer un endpoint webhook Stripe vers `https://app.halocard.ch/api/webhooks/stripe` (événement `checkout.session.completed`).
3. Ajouter sur Vercel : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER/PRO/BUSINESS`.
4. Redéployer → `isStripeEnabled()` passe à vrai → boutons actifs. Tester un achat en mode test Stripe.
