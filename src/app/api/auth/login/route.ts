import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

export async function POST(req: Request) {
  const meta = extractRequestMeta(req);

  let email: string;
  let password: string;
  try {
    const body = await req.json();
    email = body.email;
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length === 0 ||
    email.length > 254 ||
    password.length === 0 ||
    password.length > 200
  ) {
    return NextResponse.json({ error: "Email ou mot de passe invalide" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Two limiters: per-email (defeats credential stuffing on a single account)
  // and per-IP (defeats horizontal brute force from one source).
  const emailLimit = await rateLimit(`login-email:${normalizedEmail}`, 5, 15 * 60 * 1000);
  const ipLimit = await rateLimit(`login-ip:${meta.ip_address}`, 20, 15 * 60 * 1000);

  if (!emailLimit.success || !ipLimit.success) {
    await logAuditEvent({
      action: "LOGIN_FAILED",
      details: { reason: "RATE_LIMITED", email: normalizedEmail },
      ...meta,
    });
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    await logAuditEvent({
      action: "LOGIN_FAILED",
      details: { reason: "INVALID_CREDENTIALS", email: normalizedEmail },
      ...meta,
    });
    return NextResponse.json(
      { error: "Email ou mot de passe incorrect." },
      { status: 401 }
    );
  }

  // Rôle pour la redirection côté client (admin → /admin, marchand → /dashboard).
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  await logAuditEvent({
    action: "LOGIN_SUCCESS",
    user_id: data.user.id,
    merchant_id: merchant?.id,
    details: { email: normalizedEmail },
    ...meta,
  });

  return NextResponse.json({ success: true, role: merchant?.role ?? "merchant" });
}
