"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/send";
import { rateLimit } from "@/lib/rateLimit";
import { clientIp } from "@/lib/clientIp";
import { logAuditEvent } from "@/lib/auditLog";
import { validateLeadForm, type LeadFormValue } from "@/lib/leads/leadFormValidation";
import { escapeHtml } from "@/lib/email/templates";

// PostgREST signale une colonne inconnue (migration pas encore appliquée) par
// PGRST204 ; 42703 est l'équivalent Postgres direct.
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

async function insertLead(payload: Record<string, string | null>) {
  return supabaseAdmin.from("leads").insert(payload).select("id").single();
}

function fullPayload(v: LeadFormValue): Record<string, string | null> {
  return {
    business_name: v.business,
    trade: v.sector,
    contact: v.email,
    contact_name: v.contactName,
    phone: v.phone,
    message: v.message,
    plan: v.plan,
    source_path: "/demarrer",
  };
}

// Repli sans les colonnes 2026-09 (contact_name/phone/message) : on replie
// nom et téléphone dans `contact` pour ne rien perdre d'essentiel.
function legacyPayload(v: LeadFormValue): Record<string, string | null> {
  return {
    business_name: v.business,
    trade: v.sector,
    contact: [v.email, v.contactName, v.phone].filter(Boolean).join(" · "),
    plan: v.plan,
    source_path: "/demarrer",
  };
}

export async function submitLead(formData: FormData) {
  const parsed = validateLeadForm({
    business: formData.get("business"),
    sector: formData.get("sector"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
    plan: formData.get("plan"),
    website: formData.get("website"),
  });
  if (!parsed.ok) {
    // Bot détecté : faux succès, rien n'est enregistré ni envoyé.
    redirect("bot" in parsed ? "/demarrer?ok=1" : `/demarrer?erreur=${parsed.error}`);
  }
  const lead = parsed.value;

  const hdrs = new Headers(await headers());
  const ip = clientIp(hdrs);
  // Fail-open : si Upstash est absent ou injoignable, on ne bloque pas un prospect.
  let allowed = true;
  try {
    const limit = await rateLimit(`lead-ip:${ip}`, 5, 3600000); // 5/h/IP
    allowed = limit.success;
  } catch (error) {
    console.error("Lead rate-limit unavailable (fail-open):", error instanceof Error ? error.message : error);
  }
  if (!allowed) {
    redirect("/demarrer?erreur=limite");
  }

  let inserted = await insertLead(fullPayload(lead));
  if (inserted.error && isMissingColumn(inserted.error)) {
    inserted = await insertLead(legacyPayload(lead));
  }
  if (inserted.error || !inserted.data) {
    console.error("Lead insert failed:", inserted.error?.code, inserted.error?.message);
    redirect("/demarrer?erreur=technique");
  }

  // Best-effort (logAuditEvent n'échoue jamais la requête principale).
  await logAuditEvent({
    action: "LEAD_CREATED",
    details: { lead_id: inserted.data.id, business_name: lead.business, source: "web:/demarrer" },
    ip_address: ip,
    user_agent: hdrs.get("user-agent") || "unknown",
  });

  // Notification au fondateur — best-effort (no-op tant que Resend n'est pas
  // configuré). Le message libre du prospect ne transite par AUCUN email :
  // il se lit dans l'admin (/admin/leads).
  await sendEmail({
    to: "contact@halocard.ch",
    subject: `Nouveau lead : ${lead.business}`,
    html: `<p><strong>${escapeHtml(lead.business)}</strong> (${lead.sector})<br/>Contact : ${escapeHtml(lead.contactName)} — ${escapeHtml(lead.email)}${lead.phone ? ` — ${escapeHtml(lead.phone)}` : ""}<br/>Palier envisagé : ${lead.plan || "—"}<br/>${lead.message ? "Message à lire dans l'admin (/admin/leads)." : "Sans message."}</p>`,
    text: `${lead.business} (${lead.sector})\nContact : ${lead.contactName} — ${lead.email}${lead.phone ? ` — ${lead.phone}` : ""}\nPalier envisagé : ${lead.plan || "—"}\n${lead.message ? "Message à lire dans l'admin (/admin/leads)." : "Sans message."}`,
  }).catch(() => {});

  redirect("/demarrer?ok=1");
}
