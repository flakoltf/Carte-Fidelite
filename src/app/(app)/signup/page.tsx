import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSelfServiceEnabled } from "@/lib/signup/flag";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  title: "Créer mon compte — HALO",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Inscription self-service derrière le feature flag `self_service_signup`
// (fail-closed). Flag éteint : comportement historique conservé — toute
// visite redirige vers la connexion (les comptes sont créés par l'admin).
export default async function SignupPage() {
  if (!(await isSelfServiceEnabled())) {
    redirect("/login");
  }
  return <SignupClient turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />;
}
