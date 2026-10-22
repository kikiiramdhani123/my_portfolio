"use client";

import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { Reveal } from "@/components/reveal";
import { TimelineTrack } from "@/components/timeline-track";
import {
  profile,
  type ExperienceEntry,
  type EducationEntry,
} from "@/data/profile";
import { useLocale, useLocalized } from "@/lib/i18n/locale-provider";

function ExperienceItem({
  exp,
  delay,
}: {
  exp: ExperienceEntry;
  delay: number;
}) {
  const { t } = useLocale();
  const period = useLocalized(exp.period);
  const responsibilities = useLocalized(exp.responsibilities);
  const achievements = useLocalized(exp.achievements);

  return (
    <Reveal delay={delay}>
      <div className="relative pb-14 pl-8 last:pb-0">
        <span className="absolute top-1.5 -left-[7px] size-3.5 rounded-full border-2 border-background bg-primary shadow-[0_0_0_4px_var(--color-background)] ring-4 ring-primary/15 transition-[box-shadow] duration-300 hover:ring-primary/30" />

        <p className="text-sm font-medium text-muted-foreground">{period}</p>

        <h3 className="mt-1.5 text-xl font-semibold tracking-tight">
          {exp.role}
        </h3>

        <p className="mt-0.5 font-medium text-primary">
          {exp.company}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {exp.location} · {exp.employmentType}
            {exp.remote ? " · Remote" : ""}
          </span>
        </p>

        <ul className="mt-4 space-y-2">
          {responsibilities.map((responsibility, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm text-pretty text-muted-foreground"
            >
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{responsibility}</span>
            </li>
          ))}
        </ul>

        {achievements.length > 0 && (
          <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-secondary/30 p-4 transition-colors duration-300 hover:border-primary/30 hover:bg-secondary/50">
            <p className="text-xs font-medium tracking-wide text-foreground/80 uppercase">
              {t.experience.keyAchievements}
            </p>
            <ul className="space-y-1.5">
              {achievements.map((achievement, i) => (
                <li key={i} className="text-sm text-pretty">
                  {achievement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Reveal>
  );
}

function EducationItem({ edu }: { edu: EducationEntry }) {
  const degree = useLocalized(edu.degree);

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        <p className="font-medium">{degree}</p>
        <p className="text-sm text-muted-foreground">{edu.institution}</p>
      </div>
      <Badge variant="outline" className="font-normal">
        {edu.period}
      </Badge>
    </div>
  );
}

export function Experience() {
  const { t } = useLocale();

  return (
    <section
      id="experience"
      className="scroll-mt-24 border-t border-border/60 py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={t.experience.eyebrow}
          title={t.experience.title}
          description={t.experience.description}
        />

        <div className="mx-auto max-w-3xl">
          <TimelineTrack>
            {profile.experience.map((exp, index) => (
              <ExperienceItem key={exp.id} exp={exp} delay={index * 0.08} />
            ))}
          </TimelineTrack>
        </div>

        {profile.education.length > 0 && (
          <Reveal className="mx-auto mt-4 max-w-3xl border-t border-border/60 pt-10">
            <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t.experience.education}
            </p>
            <div className="space-y-4">
              {profile.education.map((edu) => (
                <EducationItem key={edu.id} edu={edu} />
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
