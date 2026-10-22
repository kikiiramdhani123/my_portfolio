"use client";

import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { profile } from "@/data/profile";
import { socialIconMap } from "@/lib/icons";
import { useLocale } from "@/lib/i18n/locale-provider";

export function Footer() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-10 text-sm text-muted-foreground md:flex-row md:justify-between">
        <p>
          &copy; {year} {profile.person.name}. {t.footer.rights}
        </p>

        <div className="flex items-center gap-4">
          {profile.social.map((link) => {
            const Icon = socialIconMap[link.icon];
            return (
              <Link
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                aria-label={link.label}
                className="text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground"
              >
                <Icon className="size-4" />
              </Link>
            );
          })}
        </div>

        <a
          href="#top"
          className="group flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          {t.footer.backToTop}
          <ArrowUp className="size-3.5 transition-transform duration-200 group-hover:-translate-y-1" />
        </a>
      </div>
    </footer>
  );
}
