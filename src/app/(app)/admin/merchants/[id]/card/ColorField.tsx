'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function normalizeHex(raw: string): string {
  const s = raw.startsWith('#') ? raw : '#' + raw;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : '';
}

export default function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value.replace('#', ''));
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep draft in sync when value changes externally
  useEffect(() => {
    setDraft(value.replace('#', ''));
  }, [value]);

  // Close on outside click
  const handleOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
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
        <span
          className="w-6 h-6 rounded-md border border-black/10 shrink-0"
          style={{ background: value }}
          aria-hidden
        />
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
              className="flex-1 bg-calcaire border border-line-warm rounded-lg px-2 py-1.5 text-sm font-mono text-onyx focus:border-halo outline-none transition-all uppercase tracking-widest"
              aria-label="Valeur hexadécimale"
            />
          </div>
        </div>
      )}
    </div>
  );
}
