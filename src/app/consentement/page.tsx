import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HaloSymbol } from "@/components/halo/HaloMark";
import { UUID_RE } from "@/lib/validation/uuid";
import { isConsentLandingState, type ConsentLandingState } from "@/lib/consent/landing";

// Page sobre d'atterrissage des liens de consentement email (double opt-in et
// désinscription). Publique, sans session, non indexée. Le nom du commerce est
// relu en base à partir de son id (jamais pris dans l'URL : une page qui
// afficherait un texte libre passé en query servirait de relais au phishing).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vos préférences email — HaloCard",
  robots: { index: false, follow: false },
};

const COPY: Record<ConsentLandingState, { title: string; body: (shop: string | null) => string }> = {
  confirme: {
    title: "Votre inscription est confirmée.",
    body: (shop) =>
      `Vous recevrez les offres ${shop ? `de ${shop}` : "du commerce"} par email. Vous pourrez vous désinscrire à tout moment, en un clic, depuis chaque email.`,
  },
  desinscrit: {
    title: "Vous êtes désinscrit.",
    body: (shop) =>
      `${shop ? `${shop} ne vous enverra` : "Ce commerce ne vous enverra"} plus d'offres par email. Votre carte de fidélité, elle, reste valable.`,
  },
  expire: {
    title: "Ce lien a expiré.",
    body: () =>
      "Le lien de confirmation n'est valable que 7 jours. Cochez à nouveau la case « offres par email » lors de votre prochain passage pour recevoir un nouveau lien.",
  },
  invalide: {
    title: "Ce lien n'est plus valable.",
    body: () => "Il a peut-être été modifié ou a déjà servi. Si vous pensez qu'il s'agit d'une erreur, adressez-vous directement au commerce.",
  },
  erreur: {
    title: "Merci de réessayer dans un instant.",
    body: () => "Nous n'avons pas pu enregistrer votre choix. Réouvrez le lien de votre email un peu plus tard — il reste valable.",
  },
};

async function shopNameFor(merchantId: string | undefined): Promise<string | null> {
  if (!merchantId || !UUID_RE.test(merchantId)) return null;
  const { data } = await supabaseAdmin.from("merchants").select("shop_name").eq("id", merchantId).maybeSingle();
  return data?.shop_name ?? null;
}

export default async function ConsentLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const etat: ConsentLandingState = isConsentLandingState(sp.etat) ? sp.etat : "invalide";
  const m = typeof sp.m === "string" ? sp.m : undefined;
  const shop = etat === "confirme" || etat === "desinscrit" ? await shopNameFor(m) : null;
  const copy = COPY[etat];

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center max-w-md">
        <HaloSymbol size={44} className="mb-4 text-halo" />
        <h1 className="font-display text-3xl tracking-tight mb-2">{copy.title}</h1>
        <p className="text-galet-ink mb-6">{copy.body(shop)}</p>
        <Link
          href="https://halocard.ch"
          className="bg-halo text-white font-semibold px-6 py-3 rounded-2xl hover:bg-halo-600 transition-all"
        >
          Aller sur halocard.ch
        </Link>
      </div>
    </div>
  );
}
