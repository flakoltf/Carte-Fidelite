import { describe, it, expect, vi } from 'vitest';
const resizeCalls: Array<{ w: number; h: number }> = [];
vi.mock('sharp', () => {
  const api: any = { resize: (opts: any) => { resizeCalls.push({ w: opts.width, h: opts.height }); return api; }, png: () => api, toBuffer: async () => Buffer.from('x') };
  return { default: () => api };
});
import { resizeLogo, APPLE_LOGO, GOOGLE_LOGO } from '../imageSizes';
describe('resizeLogo', () => {
  it('génère toutes les tailles Apple + Google', async () => {
    const out = await resizeLogo(Buffer.from('orig'));
    expect(Object.keys(out)).toEqual(expect.arrayContaining(['apple_x1','apple_x2','apple_x3','apple_icon1','apple_icon2','apple_icon3','google_logo']));
    expect(resizeCalls).toContainEqual({ w: APPLE_LOGO.x1.w, h: APPLE_LOGO.x1.h });
    expect(resizeCalls).toContainEqual({ w: GOOGLE_LOGO.w, h: GOOGLE_LOGO.h });
  });
});
