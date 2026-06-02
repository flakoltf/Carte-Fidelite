"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useHaloMotion } from "./useHaloMotion";

export function Press({ children, className }: { children: ReactNode; className?: string }) {
  const { reduced } = useHaloMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      {children}
    </motion.div>
  );
}
