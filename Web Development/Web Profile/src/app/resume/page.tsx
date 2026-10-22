import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { profile } from "@/data/profile";
import { ResumeContent } from "@/components/resume-content";

export const metadata: Metadata = {
  title: "Resume",
  description: `Download or preview ${profile.person.name}'s resume as a PDF.`,
};

export default function ResumePage() {
  const pdfPath = path.join(process.cwd(), "public", profile.resume.pdfUrl);
  const pdfExists = fs.existsSync(pdfPath);

  return <ResumeContent pdfExists={pdfExists} />;
}
