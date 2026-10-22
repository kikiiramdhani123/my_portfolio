"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { profile } from "@/data/profile";
import { useLocale, useLocalized } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function ResumeContent({ pdfExists }: { pdfExists: boolean }) {
  const { t } = useLocale();
  const lastUpdated = useLocalized(profile.resume.lastUpdated);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t.resume.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.resume.lastUpdated} {lastUpdated}
          </p>
        </div>
        <a
          href={profile.resume.pdfUrl}
          download
          className={cn(buttonVariants(), "gap-2")}
        >
          <Download className="size-4" />
          {t.resume.download}
        </a>
      </div>

      {pdfExists ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <object
            data={profile.resume.pdfUrl}
            type="application/pdf"
            className="h-[80vh] w-full"
          >
            <p className="p-6 text-sm text-muted-foreground">
              {t.resume.noInlinePreview}{" "}
              <a href={profile.resume.pdfUrl} className="text-primary underline">
                {t.resume.downloadInstead}
              </a>{" "}
              {t.resume.insteadSuffix}
            </p>
          </object>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t.resume.notFoundPrefix}{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5">
            public/resume/resume.pdf
          </code>{" "}
          {t.resume.notFoundSuffix}
        </div>
      )}
    </section>
  );
}
