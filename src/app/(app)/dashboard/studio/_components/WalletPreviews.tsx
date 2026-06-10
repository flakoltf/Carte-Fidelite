'use client';

// Aperçus temps réel du studio marchand — Apple Wallet et Google Wallet côte
// à côte, fidèles aux vrais passes (zones de champs, limites Apple, bandeau
// Google). Le panneau « suivi des tampons » est rendu séparément (StampPanel) :
// la grille n'apparaît PAS sur les passes actuels (voir manifeste).

import type { CardDesign } from '@/lib/cardDesign/types';
import BarcodeVisual from './BarcodeVisual';

export type PreviewAssets = {
  appleLogo?: string;
  appleStrip?: string;
  googleLogo?: string;
  googleHero?: string;
};

export type SampleData = Record<string, string>;

export const DEFAULT_SAMPLE: SampleData = {
  points: '7',
  nom: 'Sarah M.',
  palier: 'Argent',
};

function resolve(template: string, sample: SampleData): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => sample[key] ?? `{${key}}`);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function byZone(design: CardDesign, zone: string) {
  return design.fields.filter((f) => f.zone === zone).sort((a, b) => a.order - b.order);
}

// ─── Apple Wallet ─────────────────────────────────────────────────────────────

export function AppleWalletPreview({
  design,
  assets,
  sample = DEFAULT_SAMPLE,
}: {
  design: CardDesign;
  assets: PreviewAssets;
  sample?: SampleData;
}) {
  const { colors, programName } = design;
  const headerFields = byZone(design, 'header');
  const primaryField = byZone(design, 'primary')[0];
  const secondaryFields = byZone(design, 'secondary').slice(0, 4);
  const auxiliaryFields = byZone(design, 'auxiliary').slice(0, 4);
  const barcode = design.barcode ?? { type: 'QR' as const, source: 'card_token' as const };

  return (
    <div
      className="rounded-[14px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)] select-none w-full"
      style={{
        background: colors.background,
        color: colors.foreground,
        maxWidth: 330,
        fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
      aria-label="Aperçu Apple Wallet"
    >
      <div style={{ padding: '14px 16px' }}>
        {/* En-tête */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {assets.appleLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assets.appleLogo}
                alt={programName}
                className="w-[22px] h-[22px] rounded-[5px] object-contain shrink-0"
                style={{ background: '#ffffff' }}
              />
            ) : (
              <span
                className="flex items-center justify-center rounded-[5px] font-bold text-[11px] shrink-0"
                style={{ width: 22, height: 22, background: colors.foreground, color: colors.background }}
              >
                {initials(programName || 'HALO')}
              </span>
            )}
            <b className="text-[13px] truncate">{programName || 'Nom du programme'}</b>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {headerFields.slice(0, 1).map((f) => (
              <span key={f.id} className="text-right">
                <span className="block text-[8px] tracking-[0.08em] uppercase" style={{ color: colors.label }}>
                  {f.label}
                </span>
                <span className="block text-[12px] leading-tight">{resolve(f.value, sample)}</span>
              </span>
            ))}
            <span className="text-[11px]" style={{ opacity: 0.65 }}>
              ●●●
            </span>
          </div>
        </div>

        {/* Strip / bannière */}
        {assets.appleStrip && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assets.appleStrip}
            alt="Bannière"
            className="object-cover"
            style={{ width: 'calc(100% + 32px)', margin: '12px -16px 0', height: 84, display: 'block' }}
          />
        )}

        {/* Champ principal */}
        {primaryField && (
          <div className="mt-[18px]">
            <div className="text-[10px] tracking-[0.08em] uppercase" style={{ color: colors.label }}>
              {primaryField.label}
            </div>
            <div className="text-[30px] font-light leading-none mt-0.5">
              {resolve(primaryField.value, sample)}
            </div>
          </div>
        )}

        {/* Champs secondaires / auxiliaires */}
        {[secondaryFields, auxiliaryFields].map(
          (group, gi) =>
            group.length > 0 && (
              <div key={gi} className={`flex flex-wrap gap-x-[24px] gap-y-1 ${gi === 0 ? 'mt-[14px]' : 'mt-[10px]'}`}>
                {group.map((f) => (
                  <div key={f.id} className="min-w-0">
                    <div className="text-[9px] tracking-[0.08em] uppercase" style={{ color: colors.label }}>
                      {f.label}
                    </div>
                    <div className="text-[13px] truncate">{resolve(f.value, sample)}</div>
                  </div>
                ))}
              </div>
            )
        )}

        {/* Code-barres */}
        <div className="mt-[14px] flex justify-center rounded-lg p-2" style={{ background: '#ffffff' }}>
          <BarcodeVisual format={barcode.type} altText={barcode.altText} size={84} />
        </div>
      </div>
    </div>
  );
}

// ─── Google Wallet ────────────────────────────────────────────────────────────

export function GoogleWalletPreview({
  design,
  assets,
  sample = DEFAULT_SAMPLE,
}: {
  design: CardDesign;
  assets: PreviewAssets;
  sample?: SampleData;
}) {
  const { colors, programName } = design;
  const primaryField = byZone(design, 'primary')[0];
  const secondaryFields = byZone(design, 'secondary').slice(0, 3);
  const barcode = design.barcode ?? { type: 'QR' as const, source: 'card_token' as const };

  return (
    <div
      className="rounded-[14px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)] select-none w-full"
      style={{
        background: '#ffffff',
        color: '#1a1a1a',
        maxWidth: 330,
        fontFamily: "'Google Sans', 'Roboto', system-ui, sans-serif",
      }}
      aria-label="Aperçu Google Wallet"
    >
      {/* Bandeau coloré */}
      <div
        className="flex items-center gap-[10px]"
        style={{ background: colors.background, color: colors.foreground, padding: '12px 16px' }}
      >
        {assets.googleLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assets.googleLogo}
            alt={programName}
            className="object-contain rounded-full shrink-0"
            style={{ width: 34, height: 34, background: '#ffffff' }}
          />
        ) : (
          <span
            className="flex items-center justify-center rounded-full font-bold text-[12px] shrink-0"
            style={{ width: 34, height: 34, background: colors.foreground, color: colors.background }}
          >
            {initials(programName || 'HALO')}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[11px] truncate" style={{ opacity: 0.85 }}>
            {programName || 'Nom du programme'}
          </div>
          <b className="text-[14px] leading-tight block">Carte de fidélité</b>
        </div>
      </div>

      {/* Hero */}
      {assets.googleHero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assets.googleHero} alt="Bannière" className="object-cover" style={{ width: '100%', height: 90, display: 'block' }} />
      )}

      <div style={{ padding: '14px 16px' }}>
        {primaryField && (
          <div>
            <div className="text-[10px] tracking-[0.06em] font-medium uppercase" style={{ color: '#777' }}>
              {primaryField.label}
            </div>
            <div className="text-[26px] font-medium leading-tight" style={{ color: colors.background }}>
              {resolve(primaryField.value, sample)}
            </div>
          </div>
        )}

        {secondaryFields.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {secondaryFields.map((f) => (
              <div key={f.id} className="min-w-0">
                <div className="text-[9px] tracking-[0.06em] uppercase font-medium" style={{ color: '#777' }}>
                  {f.label}
                </div>
                <div className="text-[12px] font-medium text-[#1a1a1a] truncate">{resolve(f.value, sample)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-[10px]">
          <BarcodeVisual format={barcode.type} altText={barcode.altText} size={80} />
        </div>
      </div>
    </div>
  );
}
