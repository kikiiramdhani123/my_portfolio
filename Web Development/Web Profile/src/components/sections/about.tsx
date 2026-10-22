"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { Reveal } from "@/components/reveal";
import { profile } from "@/data/profile";
import { useLocale, useLocalized } from "@/lib/i18n/locale-provider";

export function About() {
  const { t } = useLocale();
  const paragraphs = useLocalized(profile.about.paragraphs);
  const focusAreas = useLocalized(profile.about.focusAreas);
  const yearsOfExperience = useLocalized(profile.person.yearsOfExperience);
  const availability = useLocalized(profile.person.availability);

  return (
    <section id="about" className="scroll-mt-24 border-t border-border/60 py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={t.about.eyebrow}
          title={t.about.title}
          description={t.about.description}
        />

        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5 text-pretty text-muted-foreground">
            {paragraphs.map((paragraph, index) => (
              <Reveal key={index} delay={index * 0.09}>
                <p className="leading-relaxed">{paragraph}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15}>
            <Card className="bg-secondary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-primary/20">
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t.about.experienceLabel}
                  </p>
                  <p className="mt-1 font-medium">{yearsOfExperience}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t.about.availabilityLabel}
                  </p>
                  <p className="mt-1 font-medium">{availability}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t.about.focusAreasLabel}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {focusAreas.map((area, index) => (
                      <motion.li
                        key={area}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.4,
                          delay: 0.2 + index * 0.06,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="flex gap-2 text-sm"
                      >
                        <span className="text-primary">—</span>
                        <span>{area}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
