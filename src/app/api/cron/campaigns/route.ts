import { NextResponse, type NextRequest } from "next/server";
import { fetchAudienceCardIds } from "@/lib/segments/fetch";
import { deliverToCards } from "@/lib/notifications/deliver";
import { isCampaignDue } from "@/lib/campaigns/due";
import { selectRecurringRecipients } from "@/lib/campaigns/recipients";
import { DAY_MS } from "@/lib/segments/types";
import {
  fetchDueOnceCampaigns, fetchActiveRecurringCampaigns, fetchRecentSends,
  recordCampaignSends, setLastRunOn,
} from "@/lib/campaigns/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let processed = 0;
  let pushed = 0;

  // 1) Campagnes programmées (once) dues.
  for (const c of await fetchDueOnceCampaigns(today)) {
    if (!isCampaignDue(c, today)) continue; // garde défensive
    try {
      const cardIds = await fetchAudienceCardIds(c.merchantId, c.audience);
      const res = await deliverToCards(c.merchantId, c.audience, cardIds, { title: c.title, body: c.body });
      // On n'enregistre que les cartes réellement joignables (le cooldown récurrent
      // ne doit pas "consommer" un client qui n'a pas encore installé sa carte Wallet).
      await recordCampaignSends(c.id, res.reachableIds);
      await setLastRunOn(c.id, today);
      processed++; pushed += res.pushed;
    } catch (e) {
      console.error("cron once campaign failed", c.id, e instanceof Error ? e.message : e);
    }
  }

  // 2) Campagnes récurrentes actives (avec cooldown par client).
  for (const c of await fetchActiveRecurringCampaigns()) {
    try {
      const cardIds = await fetchAudienceCardIds(c.merchantId, c.audience);
      const sinceIso = new Date(now.getTime() - c.cooldownDays * DAY_MS).toISOString();
      const lastSent = await fetchRecentSends(c.id, sinceIso);
      const recipients = selectRecurringRecipients(cardIds, lastSent, c.cooldownDays, now);
      if (recipients.length) {
        const res = await deliverToCards(c.merchantId, c.audience, recipients, { title: c.title, body: c.body });
        await recordCampaignSends(c.id, res.reachableIds);
        pushed += res.pushed;
      }
      await setLastRunOn(c.id, today);
      processed++;
    } catch (e) {
      console.error("cron recurring campaign failed", c.id, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ processed, pushed });
}

// Vercel Cron déclenche en GET ; on délègue à la même logique.
export async function GET(req: NextRequest) {
  return POST(req);
}
