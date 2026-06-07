import { describe, it, expect } from 'vitest';
import { hexToRgbString, contrastRatio } from '../color';

describe('hexToRgbString', () => {
  it('convertit #0D6B5E en rgb', () => { expect(hexToRgbString('#0D6B5E')).toBe('rgb(13, 107, 94)'); });
  it('gère le format court #fff', () => { expect(hexToRgbString('#fff')).toBe('rgb(255, 255, 255)'); });
});
describe('contrastRatio', () => {
  it('blanc sur noir ≈ 21', () => { expect(Math.round(contrastRatio('#FFFFFF', '#000000'))).toBe(21); });
  it('blanc sur émeraude HALO > 4.5 (AA)', () => { expect(contrastRatio('#FFFFFF', '#0D6B5E')).toBeGreaterThan(4.5); });
});
