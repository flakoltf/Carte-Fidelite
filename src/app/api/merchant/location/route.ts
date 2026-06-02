import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { applyMerchantLocation } from "@/lib/geo/applyLocation";
import { isValidLatLng } from "@/lib/geo/geocode";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { address, latitude, longitude } = await req.json().catch(() => ({}));
  if (typeof address !== "string" || address.trim().length < 5 || address.trim().length > 200)
    return NextResponse.json({ error: "Adresse invalide (5 à 200 caractères)." }, { status: 400 });
  if (latitude !== undefined && longitude !== undefined && !isValidLatLng(Number(latitude), Number(longitude)))
    return NextResponse.json({ error: "Coordonnées invalides." }, { status: 400 });

  const result = await applyMerchantLocation(merchantId, {
    address,
    latitude: latitude !== undefined ? Number(latitude) : undefined,
    longitude: longitude !== undefined ? Number(longitude) : undefined,
  });
  return NextResponse.json(result);
}
