"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useHaloMotion } from "./useHaloMotion";

export function Stagger({ children, gap = 0.04 }: { children: ReactNode; gap?: number }) {
  const { reduced } = useHaloMotion();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, y = 14 }: { children: ReactNode; y?: number }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
