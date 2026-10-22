"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll } from "motion/react";

export function TimelineTrack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 55%"],
  });

  return (
    <div ref={ref} className="relative">
      <div className="absolute top-0 bottom-0 left-0 w-px bg-border" />
      <motion.div
        style={{ scaleY: scrollYProgress }}
        className="absolute top-0 left-0 h-full w-px origin-top bg-primary"
      />
      {children}
    </div>
  );
}
