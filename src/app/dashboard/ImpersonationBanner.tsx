import { readImpersonationCookie } from "@/lib/admin/impersonation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import StopImpersonationButton from "./StopImpersonationButton";

export default async function ImpersonationBanner() {
  const merchantId = await readImpersonationCookie();
  if (!merchantId) return null;
  const { data } = await supabaseAdmin
    .from("merchants").select("shop_name").eq("id", merchantId).maybeSingle();
  const name = data?.shop_name ?? "ce commerçant";
  return (
    <div style={{ background: "#0D6B5E", color: "#fff", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span>⚠️ Tu agis en tant que <strong>{name}</strong></span>
      <StopImpersonationButton />
    </div>
  );
}
