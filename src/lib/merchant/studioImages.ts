// Visuels de tampons du studio marchand (Agent A) — redimensionnement serveur.
// Variante locale (territoire marchand) du pipeline lib/cardDesign/imageSizes :
// les tampons ne sont pas des assets de pass Apple/Google, ils alimentent les
// aperçus studio et la page d'enrôlement. PNG carré, fond transparent.

import sharp from 'sharp';

export const STAMP_ICON_SIZE = { w: 240, h: 240 };

export async function resizeStampIcon(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({
      width: STAMP_ICON_SIZE.w,
      height: STAMP_ICON_SIZE.h,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/** Chemin Storage des visuels de tampons, sous le préfixe du tenant. */
export function stampPath(merchantId: string, state: 'filled' | 'empty'): string {
  return `${merchantId}/stamps/${state}.png`;
}
