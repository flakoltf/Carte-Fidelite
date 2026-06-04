import { clsx } from "clsx";

/**
 * HALO logo mark — a thin circle ("halo") crossed by a single light glint.
 * Use `symbol` for the icon alone, or the default wordmark lock-up.
 */
export function HaloSymbol({
  size = 28,
  className,
  glow = "var(--color-halo-glow)",
  ring = "currentColor",
  strokeWidth = 8,
}: {
  size?: number;
  className?: string;
  glow?: string;
  ring?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="46" stroke={ring} strokeWidth={strokeWidth} />
      <circle
        cx="60"
        cy="60"
        r="46"
        stroke={glow}
        strokeWidth={strokeWidth + 1.5}
        strokeLinecap="round"
        strokeDasharray="44 290"
        transform="rotate(-58 60 60)"
      />
    </svg>
  );
}

export function HaloWordmark({
  className,
  symbolSize = 26,
}: {
  className?: string;
  symbolSize?: number;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-display text-onyx",
        className,
      )}
    >
      <span className="tracking-[0.12em] text-[1.15em] leading-none">HAL</span>
      <HaloSymbol size={symbolSize} ring="var(--color-halo)" className="mx-[0.04em]" />
    </span>
  );
}
