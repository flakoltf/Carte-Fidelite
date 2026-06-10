"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/send";
import { rateLimit } from "@/lib/rateLimit";
import { headers } from "next/headers";
import { clientIp } from "@/lib/clientIp";

const PLANS = new Set(["essentiel", "croissance", "premium"]);

function clean(v: FormDataEntryValue | null, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function submitLead(formData: FormData) {
  const business = clean(formData.get("business"), 120);
  const trade = clean(formData.get("trade"), 60);
  const contact = clean(formData.get("contact"), 160);
  const planRaw = clean(formData.get("plan"), 20).toLowerCase();
  const plan = PLANS.has(planRaw) ? planRaw : null;

  if (!business || !contact) {
    redirect("/demarrer?erreur=champs");
  }

  const ip = clientIp(new Headers(await headers()));
  const limit = await rateLimit(`lead-ip:${ip}`, 5, 3600000); // 5/h/IP
  if (!limit.success) {
    redirect("/demarrer?erreur=limite");
  }

  const { error } = await supabaseAdmin.from("leads").insert({
    business_name: business,
    trade: trade || null,
    contact,
    plan,
    source_path: "/demarrer",
  });
  if (error) {
    console.error("Lead insert failed:", error.code, error.message);
    redirect("/demarrer?erreur=technique");
  }

  // Notification au fondateur — best-effort (no-op tant que Resend n'est pas configuré).
  await sendEmail({
    to: "contact@halocard.ch",
    subject: `Nouveau lead : ${business}`,
    html: `<p><strong>${business}</strong> (${trade || "métier non précisé"})<br/>Contact : ${contact}<br/>Plan envisagé : ${plan || "—"}</p>`,
    text: `${business} (${trade || "métier non précisé"})\nContact : ${contact}\nPlan envisagé : ${plan || "—"}`,
  }).catch(() => {});

  redirect("/demarrer?ok=1");
}
