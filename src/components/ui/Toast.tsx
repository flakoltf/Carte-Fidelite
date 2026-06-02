"use client";
import { useEffect } from "react";
import { cn } from "./cn";

export function Toast({
  message,
  open,
  onClose,
  tone = "success",
  duration = 4000,
}: {
  message: string;
  open: boolean;
  onClose: () => void;
  tone?: "success" | "error";
  duration?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);
  if (!open) return null;
  return (
    <div
      aria-live="polite"
      className={cn(
        "fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-full px-4 py-2.5 text-[13px] font-medium shadow-[var(--shadow-lg)]",
        tone === "success" ? "bg-[var(--text)] text-[var(--bg)]" : "bg-red-600 text-white"
      )}
    >
      {message}
    </div>
  );
}
