export function buildNominatimUrl(address: string): string {
  return `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
}

export function parseGeocode(json: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const first = json[0] as { lat?: unknown; lon?: unknown };
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function proximityText(shopName: string): string {
  return `À deux pas — votre carte ${shopName}`;
}

// Wrapper réseau : géocode une adresse via Nominatim. null en cas d'échec.
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(buildNominatimUrl(address), {
      headers: { "User-Agent": "CarteFidelite/1.0 (support@walletcard.app)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const coords = parseGeocode(json);
    if (!coords || !isValidLatLng(coords.latitude, coords.longitude)) return null;
    return coords;
  } catch {
    return null;
  }
}
