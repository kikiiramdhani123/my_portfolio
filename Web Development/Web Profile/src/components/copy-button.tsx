"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable — silently ignore.
    }
  }

  return (
    <motion.div whileTap={{ scale: 0.97 }}>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className={cn(
          "w-full justify-between gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40",
          className,
        )}
      >
        <span>{copied ? "Copied to clipboard" : label}</span>
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <Check className="size-4 text-primary" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <Copy className="size-4 text-muted-foreground" />
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
