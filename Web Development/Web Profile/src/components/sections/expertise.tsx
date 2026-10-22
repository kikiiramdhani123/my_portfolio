"use client";

import {
  Database,
  Gauge,
  Network,
  Server,
  ShieldCheck,
  Workflow,
  Shuffle,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { profile, type ExpertiseArea } from "@/data/profile";
import { useLocale, useLocalized } from "@/lib/i18n/locale-provider";

const iconMap: Record<ExpertiseArea["icon"], LucideIcon> = {
  database: Database,
  workflow: Workflow,
  gauge: Gauge,
  shuffle: Shuffle,
  network: Network,
  server: Server,
  "shield-check": ShieldCheck,
};

function ExpertiseCard({ area }: { area: ExpertiseArea }) {
  const title = useLocalized(area.title);
  const description = useLocalized(area.description);
  const Icon = iconMap[area.icon];

  return (
    <div className="group">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-primary/15">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-semibold transition-colors duration-300 group-hover:text-primary">
        {title}
      </h3>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function Expertise() {
  const { t } = useLocale();

  return (
    <section
      id="expertise"
      className="scroll-mt-24 border-t border-border/60 py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={t.expertise.eyebrow}
          title={t.expertise.title}
          description={t.expertise.description}
        />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {profile.expertise.map((area, index) => (
            <Reveal key={area.icon} delay={(index % 3) * 0.08}>
              <ExpertiseCard area={area} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
