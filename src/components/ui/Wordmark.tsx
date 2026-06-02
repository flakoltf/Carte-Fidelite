export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[1px] font-display text-[21px] font-medium text-[var(--text)] ${className}`}
    >
      HAL
      <span className="inline-block h-[0.62em] w-[0.62em] rounded-full border-2 border-current" aria-hidden />
      <span className="sr-only">HALO</span>
    </span>
  );
}
