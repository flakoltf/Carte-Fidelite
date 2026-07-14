'use client';

// Aperçus temps réel du studio — Apple & Google. FIDÉLITÉ : ils rendent la
// SORTIE DES ADAPTERS (buildPassJson / mapToGoogleClass), pas le CardDesign brut.
// Tout ce qu'iOS/Android font subir (débordement de zones vers le dos, filet
// {points}, couche identité, bannière message, absence de zones côté Google)
// apparaît donc ici. Voir src/lib/wallet/previewModel.ts + STUDIO.md.

import { useState } from 'react';
import type { CardDesign } from '@/lib/cardDesign/types';
import { buildPreviewApplePass, buildPreviewGoogle, type PreviewContext } from '@/lib/wallet/previewModel';
import BarcodeVisual from './BarcodeVisual';

export type { PreviewContext };

export type PreviewAssets = {
  appleLogo?: string;
  appleStrip?: string;
  googleLogo?: string;
  googleHero?: string;
};

type StoreField = { key: string; value: string; label?: string };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Apple Wallet ─────────────────────────────────────────────────────────────

export function AppleWalletPreview({
  design,
  assets,
  context = {},
}: {
  design: CardDesign;
  assets: PreviewAssets;
  context?: PreviewContext;
}) {
  const [showBack, setShowBack] = useState(false);
  const pass = buildPreviewApplePass(design, context);
  const store = pass.storeCard;
  const background = String(pass.backgroundColor);
  const foreground = String(pass.foregroundColor);
  const label = String(pass.labelColor);
  const programName = design.programName || 'Nom du programme';
  const header = store.headerFields as StoreField[];
  const primary = (store.primaryFields as StoreField[])[0];
  const secondary = store.secondaryFields as StoreField[];
  const auxiliary = store.auxiliaryFields as StoreField[];
  const back = store.backFields as StoreField[];
  const barcodeType = design.barcode?.type ?? 'QR';

  return (
    <div
      className="rounded-[14px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)] select-none w-full"
      style={{
        background,
        color: foreground,
        maxWidth: 330,
        fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
      aria-label="Aperçu Apple Wallet"
    >
      <div style={{ padding: '14px 16px' }}>
        {/* En-tête : logo + logoText + 1er header field */}
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
                style={{ width: 22, height: 22, background: foreground, color: background }}
              >
                {initials(programName)}
              </span>
            )}
            <b className="text-[13px] truncate">{programName}</b>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {header.slice(0, 1).map((f) => (
              <span key={f.key} className="text-right">
                <span className="block text-[8px] tracking-[0.08em] uppercase" style={{ color: label }}>
                  {f.label}
                </span>
                <span className="block text-[12px] leading-tight">{f.value}</span>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setShowBack((s) => !s)}
              className="text-[11px] leading-none rounded-full w-[18px] h-[18px] flex items-center justify-center"
              style={{ border: `1px solid ${foreground}`, opacity: 0.7 }}
              aria-label={showBack ? 'Voir le recto' : 'Voir le dos'}
              title={showBack ? 'Recto' : 'Dos (bouton « i »)'}
            >
              {showBack ? '×' : 'i'}
            </button>
          </div>
        </div>

        {showBack ? (
          /* Verso : backFields (débordement de zones + couche identité y atterrissent) */
          <div className="mt-4 space-y-3">
            {back.length === 0 && <div className="text-[12px]" style={{ opacity: 0.6 }}>Aucun champ au dos.</div>}
            {back.map((f) => (
              <div key={f.key}>
                <div className="text-[9px] tracking-[0.08em] uppercase" style={{ color: label }}>{f.label}</div>
                <div className="text-[13px] break-words">{f.value || <span style={{ opacity: 0.4 }}>—</span>}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Strip */}
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
            {primary && (
              <div className="mt-[18px]">
                <div className="text-[10px] tracking-[0.08em] uppercase" style={{ color: label }}>{primary.label}</div>
                <div className="text-[30px] font-light leading-none mt-0.5">{primary.value}</div>
              </div>
            )}

            {/* Secondaires / auxiliaires */}
            {[secondary, auxiliary].map(
              (group, gi) =>
                group.length > 0 && (
                  <div key={gi} className={`flex flex-wrap gap-x-[24px] gap-y-1 ${gi === 0 ? 'mt-[14px]' : 'mt-[10px]'}`}>
                    {group.map((f) => (
                      <div key={f.key} className="min-w-0">
                        <div className="text-[9px] tracking-[0.08em] uppercase" style={{ color: label }}>{f.label}</div>
                        <div className="text-[13px] truncate">{f.value}</div>
                      </div>
                    ))}
                  </div>
                )
            )}

            {/* Code-barres — toujours noir sur encart blanc (rendu iOS réel) */}
            <div className="mt-[14px] flex justify-center rounded-lg p-2" style={{ background: '#ffffff' }}>
              <BarcodeVisual format={barcodeType} altText={design.barcode?.altText} size={84} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Google Wallet ────────────────────────────────────────────────────────────

export function GoogleWalletPreview({
  design,
  assets,
  context = {},
}: {
  design: CardDesign;
  assets: PreviewAssets;
  context?: PreviewContext;
}) {
  const g = buildPreviewGoogle(design, context);
  const programName = g.programName || 'Nom du programme';
  const barcodeType = design.barcode?.type ?? 'QR';

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
      {/* Bandeau coloré (hexBackgroundColor) */}
      <div
        className="flex items-center gap-[10px]"
        style={{ background: g.hexBackgroundColor, color: design.colors.foreground, padding: '12px 16px' }}
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
            style={{ width: 34, height: 34, background: design.colors.foreground, color: g.hexBackgroundColor }}
          >
            {initials(programName)}
          </span>
        )}
        <div className="min-w-0">
          <b className="text-[14px] leading-tight block truncate">{programName}</b>
        </div>
      </div>

      {/* Hero */}
      {assets.googleHero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assets.googleHero} alt="Bannière" className="object-cover" style={{ width: '100%', height: 90, display: 'block' }} />
      )}

      <div style={{ padding: '14px 16px' }}>
        {/* Module points (champ primary → loyaltyPoints) */}
        <div>
          <div className="text-[10px] tracking-[0.06em] font-medium uppercase" style={{ color: '#777' }}>{g.pointsLabel}</div>
          <div className="text-[26px] font-medium leading-tight" style={{ color: g.hexBackgroundColor }}>{g.pointsValue}</div>
        </div>

        {/* Modules texte (TOUS les champs non-primary — Google n'a pas de zones) */}
        {g.textModules.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {g.textModules.map((m) => (
              <div key={m.id} className="min-w-0">
                <div className="text-[9px] tracking-[0.06em] uppercase font-medium" style={{ color: '#777' }}>{m.header}</div>
                <div className="text-[12px] font-medium text-[#1a1a1a] break-words">{m.body}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-[10px]">
          <BarcodeVisual format={barcodeType} altText={g.barcodeAltText || undefined} size={80} />
        </div>
      </div>
    </div>
  );
}
