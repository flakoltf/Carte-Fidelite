function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hexToRgbString(hex: string): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${r}, ${g}, ${b})`;
}
function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
// Couleur de texte lisible sur un fond arbitraire (seuil AA 4.5:1).
export function readableTextOn(bg: string): '#000000' | '#FFFFFF' {
  return contrastRatio(bg, '#000000') >= 4.5 ? '#000000' : '#FFFFFF';
}
