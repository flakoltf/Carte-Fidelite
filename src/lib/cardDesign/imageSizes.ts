import sharp from 'sharp';
export const APPLE_LOGO = { x1: { w: 160, h: 50 }, x2: { w: 320, h: 100 }, x3: { w: 480, h: 150 } };
export const APPLE_ICON = { x1: { w: 29, h: 29 }, x2: { w: 58, h: 58 }, x3: { w: 87, h: 87 } };
export const GOOGLE_LOGO = { w: 660, h: 660 };
// Strip Apple (bannière du storeCard) et hero Google (image large).
export const APPLE_STRIP = { x1: { w: 375, h: 123 }, x2: { w: 750, h: 246 }, x3: { w: 1125, h: 369 } };
export const GOOGLE_HERO = { w: 1032, h: 336 };
async function fit(input: Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(input).resize({ width: w, height: h, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
// 'cover' : remplit toute la zone en rognant le débordement (adapté aux bannières).
async function cover(input: Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(input).resize({ width: w, height: h, fit: 'cover', position: 'centre' }).png().toBuffer();
}
export async function resizeLogo(input: Buffer): Promise<Record<string, Buffer>> {
  return {
    apple_x1: await fit(input, APPLE_LOGO.x1.w, APPLE_LOGO.x1.h),
    apple_x2: await fit(input, APPLE_LOGO.x2.w, APPLE_LOGO.x2.h),
    apple_x3: await fit(input, APPLE_LOGO.x3.w, APPLE_LOGO.x3.h),
    apple_icon1: await fit(input, APPLE_ICON.x1.w, APPLE_ICON.x1.h),
    apple_icon2: await fit(input, APPLE_ICON.x2.w, APPLE_ICON.x2.h),
    apple_icon3: await fit(input, APPLE_ICON.x3.w, APPLE_ICON.x3.h),
    google_logo: await fit(input, GOOGLE_LOGO.w, GOOGLE_LOGO.h),
  };
}
export async function resizeStrip(input: Buffer): Promise<Record<string, Buffer>> {
  return {
    apple_strip1: await cover(input, APPLE_STRIP.x1.w, APPLE_STRIP.x1.h),
    apple_strip2: await cover(input, APPLE_STRIP.x2.w, APPLE_STRIP.x2.h),
    apple_strip3: await cover(input, APPLE_STRIP.x3.w, APPLE_STRIP.x3.h),
    google_hero: await cover(input, GOOGLE_HERO.w, GOOGLE_HERO.h),
  };
}
