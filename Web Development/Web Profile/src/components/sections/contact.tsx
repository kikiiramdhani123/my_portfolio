"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { CopyButton } from "@/components/copy-button";
import { socialIconMap } from "@/lib/icons";
import { profile } from "@/data/profile";
import { useLocalized } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function Contact() {
  const heading = useLocalized(profile.contact.heading);
  const description = useLocalized(profile.contact.description);

  return (
    <section
      id="contact"
      className="scroll-mt-24 border-t border-border/60 py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl px-6 text-center">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {heading}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            {description}
          </p>
        </Reveal>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:mx-auto sm:max-w-sm">
          {profile.social.map((link, index) => {
            const Icon = socialIconMap[link.icon];

            if (link.copyValue) {
              return (
                <Reveal key={link.label} delay={0.1 + index * 0.06}>
                  <CopyButton
                    value={link.copyValue}
                    label={`${link.label} · ${link.copyValue}`}
                  />
                </Reveal>
              );
            }

            return (
              <Reveal key={link.label} delay={0.1 + index * 0.06}>
                <Link
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full justify-start gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary",
                  )}
                >
                  <Icon className="size-4" />
                  {link.label}
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
