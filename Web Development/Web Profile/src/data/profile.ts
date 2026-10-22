/**
 * Single source of truth for all content on the site.
 * Every "TODO:" placeholder is real content you still need to fill in —
 * nothing sensitive or unverified has been invented. Search this file
 * for "TODO:" to find every field that still needs your input.
 *
 * Prose fields are `{ en, id }` pairs so the site can switch language
 * client-side. Facts (names, dates, links, tool names) are plain strings
 * shared across both languages.
 */

export interface Localized<T> {
  en: T;
  id: T;
}

export type IconName =
  | "github"
  | "linkedin"
  | "email"
  | "phone"
  | "twitter"
  | "website";

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
  /** Shown with a copy-to-clipboard button instead of navigating (email/phone). */
  copyValue?: string;
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  companyUrl?: string;
  location: string;
  period: Localized<string>;
  employmentType: "Full-time" | "Contract" | "Freelance" | "Internship";
  remote: boolean;
  responsibilities: Localized<string[]>;
  achievements: Localized<string[]>;
}

export interface SkillGroup {
  category:
    | "Backend"
    | "Database"
    | "Programming"
    | "Data Engineering"
    | "Cloud"
    | "Tools"
    | "Version Control"
    | "DevOps";
  items: string[];
}

export interface Project {
  slug: string;
  name: string;
  summary: Localized<string>;
  problem: Localized<string>;
  role: Localized<string>;
  stack: string[];
  highlights: Localized<string[]>;
  link?: string;
  repo?: string;
  status: "placeholder" | "live" | "private-repo" | "case-study";
}

export interface ExpertiseArea {
  title: Localized<string>;
  description: Localized<string>;
  icon:
    | "database"
    | "workflow"
    | "gauge"
    | "shuffle"
    | "network"
    | "server"
    | "shield-check";
}

export interface EducationEntry {
  id: string;
  degree: Localized<string>;
  institution: string;
  period: string;
  note?: Localized<string>;
}

export const profile = {
  person: {
    name: "Rizky Ramdhani",
    // Ditampilkan di hero & tab browser.
    title: "Data Engineer",
    location: "Jakarta, Indonesia",
    headline: {
      en: "Building reliable data infrastructure that turns messy, high-volume business processes into trustworthy pipelines.",
      id: "Membangun infrastruktur data yang andal, mengubah proses bisnis yang rumit dan bervolume tinggi menjadi pipeline yang dapat dipercaya.",
    } satisfies Localized<string>,
    subheadline: {
      en: "I design and operate ETL pipelines and PostgreSQL systems that engineering and product teams depend on daily — with a focus on query performance, data integrity during migrations, and architecture that stays maintainable as it scales.",
      id: "Saya merancang dan mengoperasikan ETL pipeline serta sistem PostgreSQL yang diandalkan tim engineering dan product setiap hari — dengan fokus pada performa query, integritas data saat migrasi, dan arsitektur yang tetap mudah dipelihara seiring pertumbuhan skala.",
    } satisfies Localized<string>,
    yearsOfExperience: {
      en: "5+ years",
      id: "5+ tahun",
    } satisfies Localized<string>,
    availability: {
      en: '"Open to Data Engineer / Junior Lead Data Team / Data Analyst / Machine Learning Engineer opportunities"',
      id: '"Terbuka untuk peluang Data Engineer / Junior Lead Data Team / Data Analyst / Machine Learning Engineer"',
    } satisfies Localized<string>,
  },

  social: [
    {
      label: "Email",
      href: "mailto:kontaknyakiki@gmail.com",
      icon: "email",
      copyValue: "kontaknyakiki@gmail.com",
    },
    {
      label: "Phone",
      href: "tel:+6281234567890",
      icon: "phone",
      copyValue: "+6281234567890",
    },
    {
      label: "GitHub",
      href: "https://github.com/kikiiramdhani123/my_portfolio",
      icon: "github",
    },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/rizky-ramdhani-302726364",
      icon: "linkedin",
    },
  ] satisfies SocialLink[],

  about: {
    paragraphs: {
      en: [
        "I work as a Data Engineer focused on the systems most teams only notice when they break: the pipelines moving data between services, the PostgreSQL databases those services read and write to under load, and the migrations that move both without losing a row along the way.",
        "I started my career in data engineering with an academic background in computer science, and the moment that pulled me toward backend and data engineering was the first time I faced the challenge of designing and optimizing a truly scalable data system.",
        "I'm comfortable building ETL pipelines from scratch, writing and optimizing PostgreSQL stored procedures, functions, and triggers, and handling cross-system data migrations with little to no meaningful downtime. Most of my career has been remote, collaborating across time zones with developer and product teams.",
        "Looking ahead, I'm preparing to take on bigger responsibilities at a company with larger-scale data and more complex systems — one where clean architecture, system reliability, and backend performance are true priorities, not just a nice-to-have.",
      ],
      id: [
        "Saya bekerja sebagai Data Engineer yang fokus pada sistem yang biasanya baru disadari kebanyakan tim ketika rusak: pipeline yang memindahkan data antar layanan, basis data PostgreSQL yang dibaca-tulis layanan tersebut di bawah beban tinggi, dan migrasi yang memindahkan keduanya tanpa kehilangan satu baris data pun.",
        "Saya memulai karier di data engineering dengan latar belakang pendidikan di bidang ilmu komputer, dan momen yang membuat saya tertarik pada backend/data engineering adalah ketika saya pertama kali menghadapi tantangan dalam merancang dan mengoptimalkan sistem data yang skalabel.",
        "Saya terbiasa membangun ETL pipeline dari nol, menulis dan mengoptimasi stored procedure, function, serta trigger di PostgreSQL, dan menangani migrasi data lintas sistem tanpa downtime yang berarti. Sebagian besar karier saya dijalani secara remote, berkolaborasi lintas zona waktu dengan tim developer dan product.",
        "Ke depan, saya sedang mempersiapkan diri untuk mengambil tanggung jawab yang lebih besar di perusahaan dengan skala data dan sistem yang lebih kompleks — tempat clean architecture, keandalan sistem, dan performa backend menjadi prioritas utama, bukan sekadar nice-to-have.",
      ],
    } satisfies Localized<string[]>,
    focusAreas: {
      en: [
        "Problem-solving for large-scale data systems",
        "Backend & data engineering",
        "Database design & optimization",
        "Long-term reliability and maintainability",
      ],
      id: [
        "Problem solving pada sistem data berskala besar",
        "Backend & data engineering",
        "Optimasi & desain database",
        "Reliability dan maintainability jangka panjang",
      ],
    } satisfies Localized<string[]>,
  },

  experience: [
    {
      id: "exp-current",
      role: "Database Administrator",
      company: "Bank Rakyat Indonesia",
      companyUrl: "https://qlolabybri.com",
      location: "Jakarta",
      period: {
        en: "January 2026 — Present",
        id: "Januari 2026 — Sekarang",
      } satisfies Localized<string>,
      employmentType: "Full-time",
      remote: false,
      responsibilities: {
        en: [
          "Design and maintain ETL pipelines to consolidate data from multiple sources into the data warehouse.",
          "Write and optimize queries, stored procedures, functions, and triggers in PostgreSQL for operational and reporting needs.",
          "Handle cross-system/schema data migrations with data integrity validation.",
          "Collaborate with developer and product teams to define data requirements and API contracts.",
        ],
        id: [
          "Merancang dan memelihara ETL pipeline untuk konsolidasi data dari berbagai sumber ke data warehouse.",
          "Menulis dan mengoptimasi query, stored procedure, function, dan trigger PostgreSQL untuk kebutuhan operasional dan pelaporan.",
          "Menangani migrasi data lintas sistem/skema dengan validasi integritas data.",
          "Berkolaborasi dengan tim developer dan product untuk mendefinisikan kebutuhan data dan kontrak API.",
        ],
      } satisfies Localized<string[]>,
      achievements: {
        en: [
          '"Reduced daily report query execution time from X minutes to Y seconds through index and query plan optimization."',
          '"Led a data migration of X million rows with no significant downtime."',
        ],
        id: [
          '"Mengurangi waktu eksekusi query laporan harian dari X menit menjadi Y detik melalui optimasi index dan query plan."',
          '"Memimpin migrasi data sebesar X juta baris tanpa downtime signifikan."',
        ],
      } satisfies Localized<string[]>,
    },
    {
      id: "exp-previous-1",
      role: "Data Engineer",
      company: "PT Informasi Teknologi Indonesia (Jatis Mobile)",
      companyUrl: "https://jatismobile.com",
      location: "Jakarta",
      period: {
        en: "March 2021 — January 2026",
        id: "Maret 2021 — Januari 2026",
      } satisfies Localized<string>,
      employmentType: "Full-time",
      remote: true,
      responsibilities: {
        en: [
          "Design and maintain ETL pipelines to consolidate data from multiple sources into the data warehouse.",
          "Write and optimize queries, stored procedures, functions, and triggers in PostgreSQL for operational and reporting needs.",
          "Handle cross-system/schema data migrations with data integrity validation.",
          "Collaborate with developer and product teams to define data requirements and API contracts.",
        ],
        id: [
          "Merancang dan memelihara ETL pipeline untuk konsolidasi data dari berbagai sumber ke data warehouse.",
          "Menulis dan mengoptimasi query, stored procedure, function, dan trigger PostgreSQL untuk kebutuhan operasional dan pelaporan.",
          "Menangani migrasi data lintas sistem/skema dengan validasi integritas data.",
          "Berkolaborasi dengan tim developer dan product untuk mendefinisikan kebutuhan data dan kontrak API.",
        ],
      } satisfies Localized<string[]>,
      achievements: {
        en: [
          '"Reduced daily report query execution time from X minutes to Y seconds through index and query plan optimization."',
          '"Led a data migration of X million rows with no significant downtime."',
        ],
        id: [
          '"Mengurangi waktu eksekusi query laporan harian dari X menit menjadi Y detik melalui optimasi index dan query plan."',
          '"Memimpin migrasi data sebesar X juta baris tanpa downtime signifikan."',
        ],
      } satisfies Localized<string[]>,
    },
    // TODO: tambahkan entri pengalaman kerja lain jika ada (array ini bisa ditambah bebas).
  ] satisfies ExperienceEntry[],

  education: [
    {
      id: "edu-1",
      degree: {
        en: "Bachelor's Degree in Computer Science (Conversion Program)",
        id: "S1 Ilmu Komputer Program Alih Jenis",
      } satisfies Localized<string>,
      institution: "Institut Pertanian Bogor (IPB University)",
      period: "2016-2019",
      note: {
        en: "Conversion program",
        id: "Program Alih Jenis",
      } satisfies Localized<string>,
    },
    {
      id: "edu-2",
      degree: {
        en: "Associate Degree in Computer and Information Systems",
        id: "D3 Komputer dan Sistem Informasi",
      } satisfies Localized<string>,
      institution: "Universitas Gadjah Mada (UGM)",
      period: "2013-2016",
    },
  ] satisfies EducationEntry[],

  skills: [
    {
      category: "Data Engineering",
      items: [
        "ETL Pipeline Design",
        "Data Migration",
        "Data Validation & Integrity",
        "Batch Processing",
        "Talend Open Studio",
        "Apache Airflow",
        "GCP",
        "Pandas",
        "NumPy",
        "Scikit-learn",
        "Tableau",
      ],
    },
    {
      category: "Database",
      items: [
        "PostgreSQL",
        "Query Optimization",
        "Stored Procedures & Functions",
        "Triggers",
        "Indexing Strategy",
        "Schema Design",
      ],
    },
    {
      category: "Backend",
      items: ["API Integration", "Clean Architecture", "PHP", "Laravel"],
    },
    {
      category: "Programming",
      items: ["SQL", "Python", "Java", "MongoDB", "RUST"],
    },
    {
      category: "Cloud",
      items: ["GCP (BigQuery, Cloud Storage, Cloud Functions)", "AWS"],
    },
    {
      category: "DevOps",
      items: ["Docker", "CI/CD (GitHub Actions)", "Linux"],
    },
    {
      category: "Version Control",
      items: ["Git", "GitHub", "Bitbucket", "Bamboo"],
    },
    {
      category: "Tools",
      items: ["pgAdmin", "DBeaver", "Postman", "Jira"],
    },
  ] satisfies SkillGroup[],

  expertise: [
    {
      title: {
        en: "Database Design & Optimization",
        id: "Desain & Optimasi Basis Data",
      } satisfies Localized<string>,
      description: {
        en: "Designing normalized yet query-efficient PostgreSQL schemas, and optimizing slow queries through query plan analysis and the right indexing strategy.",
        id: "Merancang skema PostgreSQL yang normal namun tetap efisien untuk query, serta mengoptimasi query lambat melalui analisis query plan dan strategi indexing yang tepat.",
      } satisfies Localized<string>,
      icon: "database",
    },
    {
      title: {
        en: "ETL Pipeline Engineering",
        id: "Rekayasa ETL Pipeline",
      } satisfies Localized<string>,
      description: {
        en: "Building reliable extract-transform-load pipelines that move and transform data between systems, with clear validation and error handling.",
        id: "Membangun pipeline extract-transform-load yang andal untuk memindahkan dan mentransformasi data antar sistem dengan validasi dan penanganan error yang jelas.",
      } satisfies Localized<string>,
      icon: "workflow",
    },
    {
      title: {
        en: "Data Migration",
        id: "Migrasi Data",
      } satisfies Localized<string>,
      description: {
        en: "Planning and executing cross-system/schema data migrations with rollback strategies and end-to-end data integrity validation.",
        id: "Merencanakan dan mengeksekusi migrasi data lintas sistem/skema dengan strategi rollback dan validasi integritas data end-to-end.",
      } satisfies Localized<string>,
      icon: "shuffle",
    },
    {
      title: {
        en: "Query Performance",
        id: "Performa Query",
      } satisfies Localized<string>,
      description: {
        en: "Diagnosing performance bottlenecks in complex queries and stored procedures, turning slow symptoms into measurable structural fixes.",
        id: "Mendiagnosis bottleneck performa pada query kompleks dan stored procedure, menerjemahkan gejala lambat menjadi perbaikan struktural yang terukur.",
      } satisfies Localized<string>,
      icon: "gauge",
    },
    {
      title: {
        en: "API Integration",
        id: "Integrasi API",
      } satisfies Localized<string>,
      description: {
        en: "Integrating data pipelines with internal and external APIs, keeping data contracts consistent between the backend and its consumers.",
        id: "Mengintegrasikan pipeline data dengan API internal maupun eksternal, memastikan kontrak data konsisten antara backend dan konsumen data.",
      } satisfies Localized<string>,
      icon: "network",
    },
    {
      title: {
        en: "Backend Development",
        id: "Pengembangan Backend",
      } satisfies Localized<string>,
      description: {
        en: "Writing backend services around clean architecture principles so business logic stays decoupled from infrastructure details and easy to test.",
        id: "Menulis backend service dengan prinsip clean architecture agar logika bisnis tetap terpisah dari detail infrastruktur dan mudah diuji.",
      } satisfies Localized<string>,
      icon: "server",
    },
  ] satisfies ExpertiseArea[],

  projects: [
    {
      slug: "TODO-project-1",
      name: "TODO: Project Name 1",
      summary: {
        en: "TODO: One or two sentences summarizing this project and its impact.",
        id: "TODO: Ringkasan satu-dua kalimat tentang proyek ini dan dampaknya.",
      } satisfies Localized<string>,
      problem: {
        en: "TODO: What business/technical problem does this project solve?",
        id: "TODO: Masalah bisnis/teknis apa yang diselesaikan proyek ini?",
      } satisfies Localized<string>,
      role: {
        en: "TODO: Your role in this project (e.g. Data Engineer, sole owner)",
        id: "TODO: Peran Anda di proyek ini (mis. Data Engineer, penanggung jawab tunggal)",
      } satisfies Localized<string>,
      stack: ["TODO: PostgreSQL", "TODO: other stack"],
      highlights: {
        en: ["TODO: measurable result/impact from this project."],
        id: ["TODO: hasil/dampak terukur dari proyek ini."],
      } satisfies Localized<string[]>,
      link: undefined,
      repo: undefined,
      status: "placeholder",
    },
    {
      slug: "TODO-project-2",
      name: "TODO: Project Name 2",
      summary: {
        en: "TODO: Project summary.",
        id: "TODO: Ringkasan proyek.",
      } satisfies Localized<string>,
      problem: {
        en: "TODO: Problem solved.",
        id: "TODO: Masalah yang diselesaikan.",
      } satisfies Localized<string>,
      role: {
        en: "TODO: Your role.",
        id: "TODO: Peran Anda.",
      } satisfies Localized<string>,
      stack: ["TODO"],
      highlights: {
        en: ["TODO: result/impact."],
        id: ["TODO: hasil/dampak."],
      } satisfies Localized<string[]>,
      status: "placeholder",
    },
    // TODO: tambahkan proyek nyata Anda di sini — semakin spesifik (angka, skala data, dampak), semakin kuat.
  ] satisfies Project[],

  resume: {
    // TODO: taruh file PDF resume Anda di public/resume/resume.pdf lalu hapus komentar ini.
    pdfUrl: "/resume/resume.pdf",
    lastUpdated: {
      en: "TODO: e.g. July 2026",
      id: "TODO: mis. Juli 2026",
    } satisfies Localized<string>,
  },

  contact: {
    heading: {
      en: "Let's talk about your data infrastructure",
      id: "Mari bicara soal infrastruktur data Anda",
    } satisfies Localized<string>,
    description: {
      en: "Open to discussing Data Engineer / Backend Engineer roles, project collaboration, or just exchanging ideas about data architecture. The fastest way to reach me is below.",
      id: "Terbuka untuk diskusi peran Data Engineer / Backend Engineer, kolaborasi proyek, atau sekadar bertukar pikiran soal arsitektur data. Cara tercepat menghubungi saya ada di bawah.",
    } satisfies Localized<string>,
  },

  site: {
    // TODO: ganti dengan domain final Anda sebelum deploy (dipakai untuk metadata & sitemap).
    // OG/Twitter image dibuat otomatis dari src/app/opengraph-image.tsx — tidak perlu file gambar manual.
    url: "https://TODO-your-domain.com",
  },
} as const;

export type Profile = typeof profile;
