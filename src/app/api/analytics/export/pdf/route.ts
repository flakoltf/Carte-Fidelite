import { type NextRequest } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchKpis } from "@/lib/analytics/kpis";
import type { RangeKey } from "@/lib/analytics/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  const kpis = await fetchKpis(merchantId, range);

  const s = StyleSheet.create({
    page: { padding: 40, fontSize: 12 },
    h1: { fontSize: 20, marginBottom: 16 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  });
  const row = (label: string, value: string) =>
    React.createElement(View, { style: s.row }, React.createElement(Text, null, label), React.createElement(Text, null, value));
  const doc = React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: s.page },
      React.createElement(Text, { style: s.h1 }, `Rapport de performance (${range})`),
      row("Clients", String(kpis.totalCustomers)),
      row("Nouveaux", String(kpis.newCustomers)),
      row("Visites", String(kpis.visits)),
      row("Clients actifs", `${kpis.activeRate}%`),
      row("Cartes complétées", String(kpis.completedCards)),
    )
  );
  const buffer = await renderToBuffer(doc);
  return new Response(buffer as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rapport-${range}.pdf"` },
  });
}
