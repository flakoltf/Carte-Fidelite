import type { CardDesign } from '@/lib/cardDesign/types';

// ─── Token resolution ─────────────────────────────────────────────────────────

const DEMO_SAMPLE: Record<string, string> = {
  points: '7',
  nom: 'Sarah M.',
  palier: 'Argent',
};

function resolve(template: string, sample: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => sample[key] ?? `{${key}}`);
}

// ─── Logo / initials helper ───────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── QR placeholder ───────────────────────────────────────────────────────────

function QrPlaceholder({ size = 80 }: { size?: number }) {
  return (
    <div
      aria-label="QR code (aperçu)"
      style={{
        width: size,
        height: size,
        background: 'repeating-conic-gradient(#000 0 25%, #fff 0 50%) center / 14px 14px',
        borderRadius: 4,
      }}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GooglePassPreviewProps {
  design: CardDesign;
  sample?: Record<string, string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GooglePassPreview({ design, sample = {} }: GooglePassPreviewProps) {
  const data = { ...DEMO_SAMPLE, ...sample };
  const { colors, programName, logo, fields } = design;

  const primaryField = fields
    .filter((f) => f.zone === 'primary')
    .sort((a, b) => a.order - b.order)[0];

  const secondaryFields = fields
    .filter((f) => f.zone === 'secondary')
    .sort((a, b) => a.order - b.order);

  const logoUrl = logo.assets?.google?.logo;

  return (
    <div
      className="rounded-[14px] overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.36)] select-none"
      style={{
        background: '#ffffff',
        color: '#1a1a1a',
        maxWidth: 330,
        width: '100%',
        fontFamily: "'Google Sans', 'Roboto', system-ui, sans-serif",
      }}
      aria-label="Aperçu Google Wallet"
    >
      {/* ── Colored header band ────────────────────────────────────────── */}
      <div
        className="flex items-center gap-[10px]"
        style={{
          background: colors.background,
          color: colors.foreground,
          padding: '12px 16px',
        }}
      >
        {/* Circular logo or initials */}
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={programName}
            className="object-contain rounded-full shrink-0"
            style={{
              width: 34,
              height: 34,
              background: '#ffffff',
            }}
          />
        ) : (
          <span
            className="flex items-center justify-center rounded-full font-bold text-[12px] shrink-0"
            style={{
              width: 34,
              height: 34,
              background: colors.foreground,
              color: colors.background,
            }}
          >
            {initials(programName)}
          </span>
        )}

        <div>
          <div className="text-[11px]" style={{ opacity: 0.85 }}>
            {programName}
          </div>
          <b className="text-[14px] leading-tight block">Carte de fidélité</b>
        </div>
      </div>

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px' }}>

        {/* Primary field */}
        {primaryField && (
          <div>
            <div
              className="text-[10px] tracking-[0.06em] font-medium"
              style={{ color: '#777' }}
            >
              {primaryField.label.toUpperCase()}
            </div>
            <div
              className="text-[26px] font-medium leading-tight"
              style={{ color: colors.background }}
            >
              {resolve(primaryField.value, data)}
            </div>
          </div>
        )}

        {/* Secondary fields */}
        {secondaryFields.length > 0 && (
          <div className="flex gap-4 mt-2">
            {secondaryFields.slice(0, 3).map((f) => (
              <div key={f.id}>
                <div
                  className="text-[9px] tracking-[0.06em] uppercase font-medium"
                  style={{ color: '#777' }}
                >
                  {f.label}
                </div>
                <div className="text-[12px] font-medium text-[#1a1a1a]">
                  {resolve(f.value, data)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QR code */}
        <div className="flex justify-center mt-[10px]">
          <QrPlaceholder size={80} />
        </div>

      </div>
    </div>
  );
}
