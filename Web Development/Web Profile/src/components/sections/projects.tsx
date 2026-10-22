"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { Reveal } from "@/components/reveal";
import { GithubGlyph } from "@/components/icons/brand-icons";
import { profile, type Project } from "@/data/profile";
import { useLocale, useLocalized } from "@/lib/i18n/locale-provider";

function ProjectCard({ project }: { project: Project }) {
  const { t } = useLocale();
  const summary = useLocalized(project.summary);
  const problem = useLocalized(project.problem);
  const role = useLocalized(project.role);
  const highlights = useLocalized(project.highlights);

  return (
    <Card className="group flex h-full flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/10 hover:ring-primary/30">
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">
            {project.name}
          </h3>
          {project.status === "placeholder" && (
            <Badge
              variant="outline"
              className="shrink-0 animate-pulse font-normal"
            >
              {t.projects.comingSoon}
            </Badge>
          )}
        </div>

        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          {summary}
        </p>

        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="font-medium">{t.projects.problem} </span>
            <span className="text-muted-foreground">{problem}</span>
          </p>
          <p>
            <span className="font-medium">{t.projects.role} </span>
            <span className="text-muted-foreground">{role}</span>
          </p>
        </div>

        <ul className="mt-4 space-y-1.5">
          {highlights.map((highlight, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span className="text-pretty">{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {project.stack.map((tech) => (
            <Badge key={tech} variant="secondary" className="font-normal">
              {tech}
            </Badge>
          ))}
        </div>

        <div className="mt-auto flex gap-4 pt-6 text-sm font-medium">
          {project.link && (
            <Link
              href={project.link}
              target="_blank"
              rel="noreferrer"
              className="group/link flex items-center gap-1 text-primary hover:underline"
            >
              {t.projects.live}
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </Link>
          )}
          {project.repo && (
            <Link
              href={project.repo}
              target="_blank"
              rel="noreferrer"
              className="group/link flex items-center gap-1 text-primary hover:underline"
            >
              <GithubGlyph className="size-3.5 transition-transform duration-200 group-hover/link:rotate-12" />
              {t.projects.source}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Projects() {
  const { t } = useLocale();

  return (
    <section
      id="projects"
      className="scroll-mt-24 border-t border-border/60 py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={t.projects.eyebrow}
          title={t.projects.title}
          description={t.projects.description}
        />

        <div className="grid gap-6 md:grid-cols-2">
          {profile.projects.map((project, index) => (
            <Reveal key={project.slug} delay={(index % 2) * 0.08}>
              <ProjectCard project={project} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
