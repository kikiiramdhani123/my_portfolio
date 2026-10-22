import { Reveal } from "@/components/reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeadingProps) {
  const isCenter = align === "center";
  return (
    <Reveal
      className={
        isCenter
          ? "mx-auto mb-12 max-w-2xl text-center md:mb-16"
          : "mb-12 max-w-2xl md:mb-16"
      }
    >
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-balance text-muted-foreground">
          {description}
        </p>
      )}
    </Reveal>
  );
}
