"use client";

import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";

/**
 * Fade-in + gentle upward slide. Use to reveal cards, panels, and page sections.
 * Respects prefers-reduced-motion via globals.css.
 */
export function FadeIn({
  delay = 0,
  duration = 0.4,
  y = 10,
  className,
  children,
  ...props
}: {
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
  children: React.ReactNode;
} & Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger wrapper: each direct child fades in sequentially.
 * Wrap a list of cards or items to get a cascade entrance.
 */
export function StaggerIn({
  stagger = 0.07,
  delay = 0,
  className,
  children,
}: {
  stagger?: number;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Item to use inside <StaggerIn>. Fades and slides in on stagger.
 */
export function StaggerItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
