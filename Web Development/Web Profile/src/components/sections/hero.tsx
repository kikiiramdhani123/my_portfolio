"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowRight, FileText, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { profile } from "@/data/profile";
import { useLocale, useLocalized } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

const focusTags = [
  "PostgreSQL",
  "ETL Pipelines",
  "Query Optimization",
  "Data Migration",
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const wordContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const word = {
  hidden: { opacity: 0, y: "0.4em", filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function Hero() {
  const { t } = useLocale();
  const headline = useLocalized(profile.person.headline);
  const subheadline = useLocalized(profile.person.subheadline);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.3);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const spotlightX = useTransform(springX, (v) => `${v * 100}%`);
  const spotlightY = useTransform(springY, (v) => `${v * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${spotlightX} ${spotlightY}, color-mix(in oklch, var(--color-primary) 12%, transparent), transparent 70%)`;

  function handleMouseMove(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  const headlineWords = headline.split(" ");

  return (
    <section
      id="top"
      onMouseMove={handleMouseMove}
      className="relative flex min-h-[92vh] scroll-mt-24 items-center overflow-hidden"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: spotlight }}
      />

      <motion.div
        aria-hidden
        animate={{
          x: [0, 60, -30, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.15, 0.92, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-15%] left-[8%] -z-20 size-[34rem] rounded-full bg-[color-mix(in_oklch,var(--color-primary)_10%,transparent)] blur-3xl"
      />
      <motion.div
        aria-hidden
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 30, -20, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute right-[5%] bottom-[-20%] -z-20 size-[30rem] rounded-full bg-[color-mix(in_oklch,var(--color-foreground)_6%,transparent)] blur-3xl"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-5xl px-6 py-24"
      >
        <motion.div variants={item}>
          <Badge variant="secondary" className="gap-1.5 py-1.5 pr-3 pl-2">
            <MapPin className="size-3.5" />
            {profile.person.location}
          </Badge>
        </motion.div>

        <motion.h1
          variants={wordContainer}
          className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl"
        >
          {headlineWords.map((w, i) => (
            <motion.span key={i} variants={word} className="inline-block">
              {w}
              {i < headlineWords.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground"
        >
          {subheadline}
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/resume"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            )}
          >
            <FileText className="size-4" />
            {t.hero.viewResume}
          </Link>
          <Link
            href="#contact"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "group gap-2 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0",
            )}
          >
            {t.hero.contactMe}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/60 pt-6"
        >
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t.hero.coreFocus}
          </span>
          <div className="flex flex-wrap gap-2">
            {focusTags.map((tag, i) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.4,
                  delay: 0.9 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Badge
                  variant="outline"
                  className="font-normal transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {tag}
                </Badge>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
