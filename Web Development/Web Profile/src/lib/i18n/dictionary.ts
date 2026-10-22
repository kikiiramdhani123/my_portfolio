export type Locale = "en" | "id";

export const locales: Locale[] = ["en", "id"];

export interface SkillCategoryLabels {
  "Data Engineering": string;
  Database: string;
  Backend: string;
  Programming: string;
  Cloud: string;
  DevOps: string;
  "Version Control": string;
  Tools: string;
}

export interface Dictionary {
  nav: {
    about: string;
    experience: string;
    skills: string;
    projects: string;
    expertise: string;
    contact: string;
    resume: string;
  };
  hero: {
    coreFocus: string;
    viewResume: string;
    contactMe: string;
  };
  about: {
    eyebrow: string;
    title: string;
    description: string;
    experienceLabel: string;
    availabilityLabel: string;
    focusAreasLabel: string;
  };
  experience: {
    eyebrow: string;
    title: string;
    description: string;
    keyAchievements: string;
    education: string;
  };
  skills: {
    eyebrow: string;
    title: string;
    description: string;
    categories: SkillCategoryLabels;
  };
  projects: {
    eyebrow: string;
    title: string;
    description: string;
    problem: string;
    role: string;
    live: string;
    source: string;
    comingSoon: string;
  };
  expertise: {
    eyebrow: string;
    title: string;
    description: string;
  };
  resume: {
    title: string;
    lastUpdated: string;
    download: string;
    notFoundPrefix: string;
    notFoundSuffix: string;
    noInlinePreview: string;
    downloadInstead: string;
    insteadSuffix: string;
  };
  footer: {
    rights: string;
    backToTop: string;
  };
}

export const dictionary: Record<Locale, Dictionary> = {
  en: {
    nav: {
      about: "About",
      experience: "Experience",
      skills: "Skills",
      projects: "Projects",
      expertise: "Expertise",
      contact: "Contact",
      resume: "Resume",
    },
    hero: {
      coreFocus: "Core focus",
      viewResume: "View Resume",
      contactMe: "Contact Me",
    },
    about: {
      eyebrow: "About",
      title: "How I think about data systems",
      description:
        "A short version of the story — the rest is best told over a call.",
      experienceLabel: "Experience",
      availabilityLabel: "Availability",
      focusAreasLabel: "Focus areas",
    },
    experience: {
      eyebrow: "Experience",
      title: "Career timeline",
      description: "Roles, responsibilities, and the outcomes I'm accountable for.",
      keyAchievements: "Key achievements",
      education: "Education",
    },
    skills: {
      eyebrow: "Skills",
      title: "Technical toolkit",
      description:
        "Grouped by where each skill is actually applied, not just a wall of logos.",
      categories: {
        "Data Engineering": "Data Engineering",
        Database: "Database",
        Backend: "Backend",
        Programming: "Programming",
        Cloud: "Cloud",
        DevOps: "DevOps",
        "Version Control": "Version Control",
        Tools: "Tools",
      },
    },
    projects: {
      eyebrow: "Featured Projects",
      title: "Selected work",
      description: "A closer look at problems worth solving, and how I approached them.",
      problem: "Problem:",
      role: "Role:",
      live: "Live",
      source: "Source",
      comingSoon: "Case study coming soon",
    },
    expertise: {
      eyebrow: "Technical Expertise",
      title: "Where I bring the most value",
      description: "The areas I'm hired to own, not just the ones I've merely touched.",
    },
    resume: {
      title: "Resume",
      lastUpdated: "Last updated:",
      download: "Download PDF",
      notFoundPrefix: "Resume PDF not found yet. Add your file at",
      notFoundSuffix: "to enable preview and download.",
      noInlinePreview: "Your browser can't preview PDFs inline.",
      downloadInstead: "Download the resume",
      insteadSuffix: "instead.",
    },
    footer: {
      rights: "All rights reserved.",
      backToTop: "Back to top",
    },
  },
  id: {
    nav: {
      about: "Tentang",
      experience: "Pengalaman",
      skills: "Keahlian",
      projects: "Proyek",
      expertise: "Keahlian Teknis",
      contact: "Kontak",
      resume: "Resume",
    },
    hero: {
      coreFocus: "Fokus utama",
      viewResume: "Lihat Resume",
      contactMe: "Hubungi Saya",
    },
    about: {
      eyebrow: "Tentang",
      title: "Bagaimana saya memandang sistem data",
      description:
        "Versi singkat dari cerita saya — selebihnya lebih baik diceritakan lewat obrolan langsung.",
      experienceLabel: "Pengalaman",
      availabilityLabel: "Ketersediaan",
      focusAreasLabel: "Area fokus",
    },
    experience: {
      eyebrow: "Pengalaman",
      title: "Linimasa karier",
      description: "Peran, tanggung jawab, dan hasil yang saya pertanggungjawabkan.",
      keyAchievements: "Pencapaian utama",
      education: "Pendidikan",
    },
    skills: {
      eyebrow: "Keahlian",
      title: "Perangkat teknis",
      description: "Dikelompokkan berdasarkan penerapannya, bukan sekadar daftar logo.",
      categories: {
        "Data Engineering": "Rekayasa Data",
        Database: "Basis Data",
        Backend: "Backend",
        Programming: "Pemrograman",
        Cloud: "Cloud",
        DevOps: "DevOps",
        "Version Control": "Version Control",
        Tools: "Tools",
      },
    },
    projects: {
      eyebrow: "Proyek Unggulan",
      title: "Karya pilihan",
      description:
        "Tinjauan lebih dekat masalah yang layak diselesaikan, dan cara saya mendekatinya.",
      problem: "Masalah:",
      role: "Peran:",
      live: "Live",
      source: "Sumber",
      comingSoon: "Studi kasus segera hadir",
    },
    expertise: {
      eyebrow: "Keahlian Teknis",
      title: "Di mana saya paling bernilai",
      description:
        "Bidang yang dipercayakan penuh kepada saya, bukan sekadar yang pernah saya sentuh.",
    },
    resume: {
      title: "Resume",
      lastUpdated: "Terakhir diperbarui:",
      download: "Unduh PDF",
      notFoundPrefix: "Resume PDF belum tersedia. Tambahkan file Anda di",
      notFoundSuffix: "untuk mengaktifkan pratinjau dan unduhan.",
      noInlinePreview: "Browser Anda tidak dapat menampilkan PDF secara langsung.",
      downloadInstead: "Unduh resume",
      insteadSuffix: "sebagai gantinya.",
    },
    footer: {
      rights: "Seluruh hak cipta dilindungi.",
      backToTop: "Kembali ke atas",
    },
  },
};
