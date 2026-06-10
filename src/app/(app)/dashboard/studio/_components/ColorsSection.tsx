'use client';

// Section Couleurs du studio — trois couleurs (fond, texte, libellés), palettes
// harmonisées en un clic, et jauge de contraste WCAG en direct.

import { useCallback, useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { contrastRatio } from '@/lib/cardDesign/color';
import type { CardDesign } from '@/lib/cardDesign/types';

type Colors = CardDesign['colors'];

// Palettes prêtes à l'emploi (fond / texte / libellés) — contrastes AA vérifiés.
const PALETTES: { name: string; colors: Colors }[] = [
  { name: 'Émeraude HALO', colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' } },
  { name: 'Espresso', colors: { background: '#3B2A21', foreground: '#F6EFE6', label: '#C9A77C' } },
  { name: 'Ardoise safran', colors: { background: '#1F2937', foreground: '#FDF6EC', label: '#E8B04B' } },
  { name: 'Prune poudrée', colors: { background: '#2E2433', foreground: '#F7F1F8', label: '#C9A8D6' } },
  { name: 'Terracotta', colors: { background: '#8C4A1F', foreground: '#FFF6EA', label: '#F2C28B' } },
  { name: 'Encre marine', colors: { background: '#16243D', foreground: '#F2F6FF', label: '#9DB8E8' } },
  { name: 'Forêt', colors: { background: '#10403B', foreground: '#F2F7F5', label: '#8FD0C5' } },
  { name: 'Carbone', colors: { background: '#1B1B1F', foreground: '#FAFAF7', label: '#B9B9B2' } },
];

function normalizeHex(raw: string): string {
  const s = raw.startsWith('#') ? raw : '#' + raw;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : '';
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value.replace('#', ''));
  const containerRef = useRef<HTMLDivElement>(null);

  // Resynchronise le champ texte quand la couleur change ailleurs (palette,
  // pipette) — pattern « adjusting state during render », sans effet.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value.replace('#', ''));
  }

  const handleOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
  }, []);
  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, handleOutside]);

  const commitDraft = () => {
    const hex = normalizeHex(draft);
    if (hex) onChange(hex);
    else setDraft(value.replace('#', ''));
  };

  return (
    <div ref={containerRef} className="relative">
      <p className="text-xs font-medium text-galet-ink mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 bg-surface border border-line-warm rounded-xl px-3 py-2 hover:border-halo transition-colors w-full"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="w-6 h-6 rounded-md border border-black/10 shrink-0" style={{ background: value }} aria-hidden />
        <code className="text-sm font-mono text-onyx">{value.toUpperCase()}</code>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Sélecteur de couleur — ${label}`}
          className="absolute z-30 mt-2 bg-surface border border-line-warm rounded-2xl shadow-xl p-4 space-y-3 min-w-[220px]"
        >
          <HexColorPicker color={value} onChange={onChange} style={{ width: '100%' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-galet-ink font-mono">#</span>
            <input
              value={draft}
              maxLength={6}
              placeholder="0D6B5E"
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft();
                if (e.key === 'Escape') setOpen(false);
              }}
              className="flex-1 bg-calcaire border border-line-warm rounded-lg px-2 py-1.5 text-sm font-mono text-onyx focus:border-halo outline-none uppercase tracking-widest"
              aria-label="Valeur hexadécimale"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ContrastChip({ label, ratio }: { label: string; ratio: number }) {
  const ok = ratio >= 4.5;
  const mid = ratio >= 3;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        ok ? 'bg-halo/10 text-halo' : mid ? 'bg-amber-500/15 text-amber-700' : 'bg-red-500/10 text-red-700'
      }`}
      title={ok ? 'Conforme WCAG AA (≥ 4.5:1)' : 'Sous le seuil WCAG AA de 4.5:1'}
    >
      {label} · {ratio.toFixed(1)}:1 {ok ? '✓' : mid ? '≈' : '✕'}
    </span>
  );
}

export default function ColorsSection({
  colors,
  onChange,
}: {
  colors: Colors;
  onChange: (colors: Colors) => void;
}) {
  let textRatio = 21;
  let labelRatio = 21;
  try {
    textRatio = contrastRatio(colors.background, colors.foreground);
    labelRatio = contrastRatio(colors.background, colors.label);
  } catch {
    /* couleur en cours de saisie */
  }

  return (
    <div className="space-y-5">
      {/* Palettes */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-2">Palettes harmonisées</p>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => {
            const active =
              p.colors.background === colors.background &&
              p.colors.foreground === colors.foreground &&
              p.colors.label === colors.label;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onChange({ ...p.colors })}
                title={p.name}
                aria-label={`Palette ${p.name}`}
                className={`group flex items-center gap-1.5 rounded-full border px-2 py-1.5 transition-all ${
                  active ? 'border-halo bg-halo/5' : 'border-line-warm hover:border-halo/60'
                }`}
              >
                <span className="flex -space-x-1.5">
                  <span className="w-5 h-5 rounded-full border-2 border-surface" style={{ background: p.colors.background }} />
                  <span className="w-5 h-5 rounded-full border-2 border-surface" style={{ background: p.colors.label }} />
                  <span className="w-5 h-5 rounded-full border-2 border-surface" style={{ background: p.colors.foreground }} />
                </span>
                <span className="text-[11px] text-galet-ink group-hover:text-onyx pr-1">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Couleurs individuelles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ColorInput label="Fond" value={colors.background} onChange={(v) => onChange({ ...colors, background: v })} />
        <ColorInput label="Texte" value={colors.foreground} onChange={(v) => onChange({ ...colors, foreground: v })} />
        <ColorInput label="Libellés" value={colors.label} onChange={(v) => onChange({ ...colors, label: v })} />
      </div>

      {/* Contraste live */}
      <div className="flex flex-wrap items-center gap-2">
        <ContrastChip label="Texte / fond" ratio={textRatio} />
        <ContrastChip label="Libellés / fond" ratio={labelRatio} />
        <span className="text-[11px] text-galet">Seuil de lisibilité WCAG AA : 4.5:1</span>
      </div>
    </div>
  );
}
