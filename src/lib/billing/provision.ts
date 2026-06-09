import { cardLimitForPlan } from "./plans";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMerchantInviteEmail } from "@/lib/email/templates/invite";
import type { GenerateLinkParams } from "@supabase/supabase-js";

export type ProvisionInput = {
  email: string;
  plan: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

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
    // shop_name est NOT NULL : valeur par défaut dérivée de l'email, modifiable
    // ensuite par le commerçant. Sur retry webhook (même stripe_customer_id,
    // avant tout login), ré-écrire cette valeur par défaut est bénin.
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

// Adaptateurs prod (non couverts par les tests unitaires).
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://app.halocard.ch";

export function prodDeps(): ProvisionDeps {
  return {
    findUserByEmail: async (email) => {
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
      return data as { id: string; shop_name: string };
    },
    generateInviteLink: async (email, userExists) => {
      // Cast nécessaire : TypeScript ne peut pas discriminer le type union
      // "recovery" | "invite" à la compilation avec l'opérateur ternaire.
      const params = {
        type: userExists ? "recovery" : "invite",
        email,
        options: { redirectTo: `${BASE_URL}/definir-mot-de-passe` },
      } as GenerateLinkParams;
      const { data, error } = await supabaseAdmin.auth.admin.generateLink(params);
      if (error || !data.properties?.action_link) throw new Error(`generateLink: ${error?.message}`);
      return data.properties.action_link;
    },
    sendInviteEmail: sendMerchantInviteEmail,
  };
}
