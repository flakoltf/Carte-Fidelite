import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 font-display text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.01em] text-[var(--text)]">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}
