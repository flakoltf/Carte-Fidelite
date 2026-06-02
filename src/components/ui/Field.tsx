"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export function Field({
  label,
  error,
  helper,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; helper?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--text)]">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : helper ? `${id}-help` : undefined}
        className={cn(
          "h-11 rounded-[var(--radius-md)] border bg-[var(--surface)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-shadow",
          "focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
          error ? "border-red-500" : "border-[var(--line)]",
          className
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-help`} className="text-[12px] text-[var(--text-muted)]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
