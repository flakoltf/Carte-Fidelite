import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]", className)}
      aria-hidden
    />
  );
}
