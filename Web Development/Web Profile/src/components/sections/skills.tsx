"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { Reveal } from "@/components/reveal";
import { profile } from "@/data/profile";
import { useLocale } from "@/lib/i18n/locale-provider";

const badgeContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045 },
  },
};

const badgeItem = {
  hidden: { opacity: 0, scale: 0.75, y: 6 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function Skills() {
  const { t } = useLocale();

  return (
    <section
      id="skills"
      className="scroll-mt-24 border-t border-border/60 py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={t.skills.eyebrow}
          title={t.skills.title}
          description={t.skills.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {profile.skills.map((group, index) => (
            <Reveal key={group.category} delay={(index % 2) * 0.08}>
              <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-primary/20">
                <CardContent>
                  <p className="text-sm font-semibold">
                    {t.skills.categories[group.category]}
                  </p>
                  <motion.div
                    variants={badgeContainer}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-40px" }}
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    {group.items.map((item) => (
                      <motion.div key={item} variants={badgeItem}>
                        <Badge
                          variant="secondary"
                          className="font-normal transition-colors hover:bg-primary/15 hover:text-primary"
                        >
                          {item}
                        </Badge>
                      </motion.div>
                    ))}
                  </motion.div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
