import { describe, it, expect } from 'vitest';
import { hexToRgbString, contrastRatio, readableTextOn } from '../color';

describe('hexToRgbString', () => {
  it('convertit #0D6B5E en rgb', () => { expect(hexToRgbString('#0D6B5E')).toBe('rgb(13, 107, 94)'); });
  it('gère le format court #fff', () => { expect(hexToRgbString('#fff')).toBe('rgb(255, 255, 255)'); });
});
describe('contrastRatio', () => {
  it('blanc sur noir ≈ 21', () => { expect(Math.round(contrastRatio('#FFFFFF', '#000000'))).toBe(21); });
  it('blanc sur émeraude HALO > 4.5 (AA)', () => { expect(contrastRatio('#FFFFFF', '#0D6B5E')).toBeGreaterThan(4.5); });
});
describe('readableTextOn', () => {
  it('fond clair → texte noir', () => { expect(readableTextOn('#FFFFFF')).toBe('#000000'); });
  it('fond brun sombre (#3B2A21) → texte blanc', () => { expect(readableTextOn('#3B2A21')).toBe('#FFFFFF'); });
  it('fond ardoise (#1F2937) → texte blanc', () => { expect(readableTextOn('#1F2937')).toBe('#FFFFFF'); });
  it('émeraude HALO (#0D6B5E) → texte blanc', () => { expect(readableTextOn('#0D6B5E')).toBe('#FFFFFF'); });
  it('jaune vif (#FACC15) → texte noir', () => { expect(readableTextOn('#FACC15')).toBe('#000000'); });
  it('format court #fff → noir', () => { expect(readableTextOn('#fff')).toBe('#000000'); });
});
