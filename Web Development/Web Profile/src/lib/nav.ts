export interface NavItem {
  href: string;
  key: "about" | "experience" | "skills" | "projects" | "expertise" | "contact";
}

export const navItems: NavItem[] = [
  { href: "#about", key: "about" },
  { href: "#experience", key: "experience" },
  { href: "#skills", key: "skills" },
  { href: "#projects", key: "projects" },
  { href: "#expertise", key: "expertise" },
  { href: "#contact", key: "contact" },
];
