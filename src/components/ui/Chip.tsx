import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]",
        className
      )}
      {...props}
    />
  );
}
