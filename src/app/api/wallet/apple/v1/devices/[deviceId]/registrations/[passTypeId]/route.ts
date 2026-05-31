import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { filterUpdatedSerials } from "@/lib/wallet/updates";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string }> }) {
  const { deviceId, passTypeId } = await params;
  const sinceTag = new URL(req.url).searchParams.get("passesUpdatedSince") ?? undefined;

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number")
    .eq("device_library_id", deviceId).eq("pass_type_id", passTypeId);
  const serials = (regs ?? []).map((r) => r.serial_number as string);
  if (!serials.length) return new NextResponse(null, { status: 204 });

  const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("id, pass_updated_at").in("id", serials);
  const list = (cards ?? []).map((c) => ({
    serial: c.id as string,
    updatedAt: c.pass_updated_at ? new Date(c.pass_updated_at as string).getTime() : 0,
  }));
  const { serials: fresh, lastUpdated } = filterUpdatedSerials(list, sinceTag);
  if (!fresh.length) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ serialNumbers: fresh, lastUpdated });
}
