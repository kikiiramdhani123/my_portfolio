"use client";

import { motion } from "motion/react";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

const options: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "id", label: "ID" },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="relative flex h-9 items-center rounded-lg border border-border bg-background p-0.5 text-sm">
      {options.map((option) => {
        const isActive = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLocale(option.value)}
            aria-pressed={isActive}
            aria-label={`Switch to ${option.value === "en" ? "English" : "Indonesian"}`}
            className={cn(
              "relative z-10 flex h-8 w-9 items-center justify-center rounded-md font-medium transition-colors",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="language-toggle-pill"
                className="absolute inset-0 -z-10 rounded-md bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
