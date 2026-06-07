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

function QrPlaceholder({ size = 84 }: { size?: number }) {
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

interface ApplePassPreviewProps {
  design: CardDesign;
  sample?: Record<string, string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApplePassPreview({ design, sample = {} }: ApplePassPreviewProps) {
  const data = { ...DEMO_SAMPLE, ...sample };
  const { colors, programName, logo, fields } = design;

  const headerFields = fields
    .filter((f) => f.zone === 'header')
    .sort((a, b) => a.order - b.order);

  const primaryField = fields
    .filter((f) => f.zone === 'primary')
    .sort((a, b) => a.order - b.order)[0];

  const secondaryFields = fields
    .filter((f) => f.zone === 'secondary')
    .sort((a, b) => a.order - b.order);

  const auxiliaryFields = fields
    .filter((f) => f.zone === 'auxiliary')
    .sort((a, b) => a.order - b.order);

  const logoUrl = logo.assets?.apple?.x1;

  return (
    <div
      className="rounded-[14px] overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.36)] select-none"
      style={{
        background: colors.background,
        color: colors.foreground,
        maxWidth: 330,
        width: '100%',
        fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
      aria-label="Aperçu Apple Wallet"
    >
      <div style={{ padding: '14px 16px' }}>

        {/* ── Header row ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Logo or initials */}
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={programName}
                className="w-[22px] h-[22px] rounded-[5px] object-contain"
                style={{ background: '#ffffff' }}
              />
            ) : (
              <span
                className="flex items-center justify-center rounded-[5px] font-bold text-[11px] shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  background: colors.foreground,
                  color: colors.background,
                }}
              >
                {initials(programName)}
              </span>
            )}

            {/* Program name */}
            <b className="text-[13px]">{programName}</b>

            {/* Extra header fields */}
            {headerFields.slice(0, 2).map((f) => (
              <span key={f.id} className="text-[11px]" style={{ color: colors.label }}>
                {resolve(f.value, data)}
              </span>
            ))}
          </div>

          {/* iOS dots / options indicator */}
          <span className="text-[11px]" style={{ opacity: 0.7 }}>●●●</span>
        </div>

        {/* ── Primary field ────────────────────────────────────────────────── */}
        {primaryField && (
          <div className="flex justify-between items-end mt-[18px]">
            <div>
              <div
                className="text-[10px] tracking-[0.08em]"
                style={{ color: colors.label }}
              >
                {primaryField.label.toUpperCase()}
              </div>
              <div className="text-[30px] font-light leading-none mt-0.5">
                {resolve(primaryField.value, data)}
              </div>
            </div>
          </div>
        )}

        {/* ── Secondary fields ─────────────────────────────────────────────── */}
        {secondaryFields.length > 0 && (
          <div className="flex gap-[26px] mt-[14px]">
            {secondaryFields.slice(0, 4).map((f) => (
              <div key={f.id}>
                <div
                  className="text-[9px] tracking-[0.08em]"
                  style={{ color: colors.label }}
                >
                  {f.label.toUpperCase()}
                </div>
                <div className="text-[13px]">{resolve(f.value, data)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Auxiliary fields ─────────────────────────────────────────────── */}
        {auxiliaryFields.length > 0 && (
          <div className="flex gap-[26px] mt-[10px]">
            {auxiliaryFields.slice(0, 4).map((f) => (
              <div key={f.id}>
                <div
                  className="text-[9px] tracking-[0.08em]"
                  style={{ color: colors.label }}
                >
                  {f.label.toUpperCase()}
                </div>
                <div className="text-[13px]">{resolve(f.value, data)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── QR code ──────────────────────────────────────────────────────── */}
        <div
          className="mt-[14px] flex justify-center rounded-lg p-2"
          style={{ background: '#ffffff' }}
        >
          <QrPlaceholder size={84} />
        </div>

      </div>
    </div>
  );
}
