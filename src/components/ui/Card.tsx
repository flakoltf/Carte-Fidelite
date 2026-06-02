import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({
  elevated = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--line)]",
        elevated ? "shadow-[var(--shadow-lg)]" : "shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    />
  );
}
