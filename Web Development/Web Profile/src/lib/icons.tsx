import { Globe, Mail, Phone } from "lucide-react";
import type { IconName } from "@/data/profile";
import { GithubGlyph, LinkedinGlyph } from "@/components/icons/brand-icons";

export const socialIconMap: Record<IconName, React.ComponentType<{ className?: string }>> = {
  github: GithubGlyph,
  linkedin: LinkedinGlyph,
  email: Mail,
  phone: Phone,
  twitter: Globe,
  website: Globe,
};
