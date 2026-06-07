import type { BarcodeFormat } from '@/lib/cardDesign/types';

// Aperçu visuel (non scannable) du code-barres, adapté au format choisi.
export default function BarcodePreview({
  format,
  altText,
  size = 84,
}: {
  format: BarcodeFormat;
  altText?: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {format === 'CODE128' ? (
        <div
          aria-label="Code 128 (aperçu)"
          style={{
            width: size * 2,
            height: size * 0.5,
            background:
              'repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 4px, #000 4px 7px, #fff 7px 9px, #000 9px 11px, #fff 11px 14px)',
            borderRadius: 2,
          }}
        />
      ) : format === 'PDF417' ? (
        <div
          aria-label="PDF417 (aperçu)"
          style={{
            width: size * 2,
            height: size * 0.66,
            background:
              'repeating-linear-gradient(90deg, #000 0 3px, #fff 3px 5px, #000 5px 6px, #fff 6px 9px), repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0 4px, transparent 4px 8px)',
            borderRadius: 2,
          }}
        />
      ) : (
        // QR + Aztec : motif carré.
        <div
          aria-label={`${format} (aperçu)`}
          style={{
            width: size,
            height: size,
            background: 'repeating-conic-gradient(#000 0 25%, #fff 0 50%) center / 14px 14px',
            borderRadius: 4,
          }}
        />
      )}
      {altText ? (
        <span style={{ fontSize: 9, color: '#555', maxWidth: size * 2, textAlign: 'center' }}>
          {altText}
        </span>
      ) : null}
    </div>
  );
}
