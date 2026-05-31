import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApplePassAuth, safeCompare } from "@/lib/wallet/authToken";
import { buildApplePassBuffer } from "@/lib/applePass";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ passTypeId: string; serial: string }> }) {
  const { passTypeId, serial } = await params;
  const expectedPassTypeId = process.env.APPLE_PASS_TYPE_ID || "pass.com.walletcard.fidelite";
  if (passTypeId !== expectedPassTypeId) return new NextResponse("not found", { status: 404 });
  const token = parseApplePassAuth(req.headers.get("authorization"));
  const { data: card } = await supabaseAdmin
    .from("loyalty_cards")
    .select("stamps_count, auth_token, customers(full_name), merchants(shop_name, primary_color)")
    .eq("id", serial).single();
  if (!card) return new NextResponse("not found", { status: 404 });
  if (!safeCompare(token, card.auth_token as string | null)) return new NextResponse("unauthorized", { status: 401 });

  const customer = card.customers as unknown as { full_name?: string } | null;
  const merchant = card.merchants as unknown as { shop_name?: string; primary_color?: string } | null;
  const buffer = await buildApplePassBuffer({
    cardId: serial,
    customerName: customer?.full_name ?? "Client",
    stamps: (card.stamps_count as number) ?? 0,
    branding: { shopName: merchant?.shop_name ?? null, primaryColor: merchant?.primary_color ?? null },
  });
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": new Date().toUTCString() },
  });
}
