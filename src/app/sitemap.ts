import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BASE = "https://halocard.ch";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/demarrer`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/cgv`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Pages publiques commerçants — actif SEO local (best-effort : le sitemap
  // ne doit jamais casser si la DB est indisponible).
  let merchantPages: MetadataRoute.Sitemap = [];
  try {
    const { data } = await supabaseAdmin
      .from("merchants")
      .select("slug")
      .not("slug", "is", null);
    merchantPages = (data ?? []).map((m) => ({
      url: `${BASE}/c/${m.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  } catch {
    // silencieux : sitemap statique seul
  }

  return [...staticPages, ...merchantPages];
}
