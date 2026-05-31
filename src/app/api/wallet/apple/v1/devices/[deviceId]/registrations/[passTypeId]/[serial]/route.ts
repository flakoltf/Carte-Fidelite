import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApplePassAuth } from "@/lib/wallet/authToken";

export const runtime = "nodejs";

async function authorize(req: Request, serial: string): Promise<boolean> {
  const token = parseApplePassAuth(req.headers.get("authorization"));
  if (!token) return false;
  const { data } = await supabaseAdmin.from("loyalty_cards").select("auth_token").eq("id", serial).single();
  return !!data?.auth_token && data.auth_token === token;
}

export async function POST(req: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> }) {
  const { deviceId, passTypeId, serial } = await params;
  if (!(await authorize(req, serial))) return new NextResponse("unauthorized", { status: 401 });
  const { pushToken } = await req.json().catch(() => ({}));
  if (!pushToken || typeof pushToken !== "string") return new NextResponse("bad request", { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("wallet_device_registrations").select("id")
    .eq("device_library_id", deviceId).eq("serial_number", serial).maybeSingle();
  if (existing) return new NextResponse(null, { status: 200 });

  await supabaseAdmin.from("wallet_device_registrations").insert({
    device_library_id: deviceId, pass_type_id: passTypeId, serial_number: serial, push_token: pushToken,
  });
  return new NextResponse(null, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> }) {
  const { deviceId, serial } = await params;
  if (!(await authorize(req, serial))) return new NextResponse("unauthorized", { status: 401 });
  await supabaseAdmin.from("wallet_device_registrations").delete()
    .eq("device_library_id", deviceId).eq("serial_number", serial);
  return new NextResponse(null, { status: 200 });
}
