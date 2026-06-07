import sharp from 'sharp';
export const APPLE_LOGO = { x1: { w: 160, h: 50 }, x2: { w: 320, h: 100 }, x3: { w: 480, h: 150 } };
export const APPLE_ICON = { x1: { w: 29, h: 29 }, x2: { w: 58, h: 58 }, x3: { w: 87, h: 87 } };
export const GOOGLE_LOGO = { w: 660, h: 660 };
async function fit(input: Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(input).resize({ width: w, height: h, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
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
