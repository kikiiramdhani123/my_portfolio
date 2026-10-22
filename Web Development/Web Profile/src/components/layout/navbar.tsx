"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { FileText, Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/lib/i18n/locale-provider";
import { navItems } from "@/lib/nav";
import { profile } from "@/data/profile";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const [activeHash, setActiveHash] = useState("");
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) return;

    const sections = navItems
      .map((item) => document.querySelector(item.href))
      .filter((el): el is Element => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHash(`#${entry.target.id}`);
          }
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isHome]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-tight"
        >
          {profile.person.name}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = isHome && activeHash === item.href;
            return (
              <Link
                key={item.href}
                href={isHome ? item.href : `/${item.href}`}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "text-foreground",
                )}
              >
                {t.nav[item.key]}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-indicator"
                    className="absolute inset-x-2 -bottom-px h-px bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/resume"
            className={cn(buttonVariants({ size: "sm" }), "gap-2")}
          >
            <FileText className="size-4" />
            {t.nav.resume}
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageToggle />
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">
                  {profile.person.name}
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1 px-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={isHome ? item.href : `/${item.href}`}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-base text-foreground/90 hover:bg-accent"
                  >
                    {t.nav[item.key]}
                  </Link>
                ))}
                <Link
                  href="/resume"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-2 rounded-md bg-primary px-3 py-2.5 text-base text-primary-foreground"
                >
                  <FileText className="size-4" />
                  {t.nav.resume}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
