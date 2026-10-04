/**
 * MimiOS Admin Configuration Types
 *
 * These types define the admin configuration layer.
 * They are SEPARATE from VFS/IndexedDB visitor storage.
 */

// ============ APPEARANCE ============

export interface AppearanceConfig {
  background: {
    image: string;        // URL or path to background image
    position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'cover' | 'contain';
    size: 'cover' | 'contain' | 'auto' | '100% 100%';
    overlay: string;      // CSS color with alpha, e.g., 'rgba(0,0,0,0.3)'
    color: string;        // Fallback background color
  };
  panel: {
    position: 'top' | 'bottom';
    height: number;
    transparency: number;
  };
}

// ============ PORTFOLIO ============

export interface ContactInfo {
  github?: string;
  linkedin?: string;
  email?: string;
  website?: string;
  twitter?: string;
  discord?: string;
}

export interface PortfolioConfig {
  name: string;
  title: string;
  shortDescription: string;
  aboutText: string;
  contact: ContactInfo;
}

// ============ PROJECTS ============

export interface ProjectConfig {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  featuredImage?: string;  // assetPath to image
  visibility: 'public' | 'hidden';
  order: number;
  featured: boolean;
}

// ============ SKILLS ============

export interface SkillConfig {
  id: string;
  name: string;
  category: SkillCategory;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  order: number;
  visibility: boolean;
}

export type SkillCategory =
  | 'programming'
  | 'cybersecurity'
  | 'web'
  | 'tools'
  | 'infrastructure'
  | 'databases'
  | 'other';

// ============ EXPERIENCE ============

export interface ExperienceConfig {
  id: string;
  organization: string;
  role: string;
  startDate: string;      // ISO date string (YYYY-MM)
  endDate?: string;       // ISO date string or 'present'
  description: string;
  technologies: string[];
  link?: string;
  order: number;
  visibility: boolean;
}

// ============ CERTIFICATES ============

export interface CertificateConfig {
  id: string;
  name: string;
  issuer: string;
  date: string;           // ISO date string (YYYY-MM)
  description?: string;
  assetPath?: string;     // assetPath to certificate image/PDF
  link?: string;
  order: number;
  visibility: boolean;
}

// ============ ASSETS ============

export interface AssetConfig {
  id: string;
  name: string;
  category: 'image' | 'video' | 'document';
  assetPath: string;      // Path under public/portfolio/
  mimeType: string;
  size?: number;
  featured: boolean;
  visibility: boolean;
  tags: string[];
  order: number;
}

// ============ SETTINGS ============

export interface SettingsConfig {
  configVersion: number;
  lastModified: string;   // ISO timestamp
  adminConfigured: boolean;
}

// ============ FULL ADMIN CONFIG ============

export interface AdminConfig {
  appearance: AppearanceConfig;
  portfolio: PortfolioConfig;
  projects: ProjectConfig[];
  skills: SkillConfig[];
  experience: ExperienceConfig[];
  certificates: CertificateConfig[];
  assets: AssetConfig[];
  settings: SettingsConfig;
}

// ============ DEFAULTS ============

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  background: {
    image: '',
    position: 'center',
    size: 'cover',
    overlay: 'rgba(0, 0, 0, 0.3)',
    color: '#1a1a2e',
  },
  panel: {
    position: 'top',
    height: 40,
    transparency: 0.8,
  },
};

export const DEFAULT_PORTFOLIO: PortfolioConfig = {
  name: 'Pratyush',
  title: 'Full-stack Developer',
  shortDescription: 'Building creative web experiences',
  aboutText: `Pratyush — Full-stack Developer

Passionate about building creative web experiences.
Experience across the full stack: React, TypeScript, Node.js, Python, Go.
Enjoy crafting elegant solutions to complex problems.

When not coding: exploring new technologies, contributing to open source,
or experimenting with creative coding projects.

This portfolio is itself a project — a browser-based OS simulation
built with React and TypeScript.`,
  contact: {
    github: 'https://github.com/pratyush',
    linkedin: 'https://linkedin.com/in/pratyush',
    email: 'pratyush@example.com',
    website: 'https://pratyush.dev',
  },
};

export const DEFAULT_PROJECTS: ProjectConfig[] = [
  {
    id: 'securevault',
    name: 'SecureVault',
    description: 'A secure password manager with end-to-end encryption.',
    longDescription: `A secure password manager with end-to-end encryption.

**Tech Stack:** React, TypeScript, Node.js, PostgreSQL, WebCrypto API

**Features:**
- Zero-knowledge encryption
- Cross-device sync
- Browser extension
- Mobile responsive`,
    technologies: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'WebCrypto API'],
    githubUrl: '',
    liveUrl: '',
    featuredImage: '',
    visibility: 'public',
    order: 1,
    featured: true,
  },
  {
    id: 'nids',
    name: 'Network Intrusion Detection System (NIDS)',
    description: 'A lightweight network monitoring and intrusion detection system.',
    longDescription: `A lightweight network monitoring and intrusion detection system.

**Tech Stack:** Go, eBPF, Prometheus, Grafana

**Features:**
- Real-time packet analysis
- Anomaly detection
- Alerting system
- Dashboard visualization`,
    technologies: ['Go', 'eBPF', 'Prometheus', 'Grafana'],
    githubUrl: '',
    liveUrl: '',
    featuredImage: '',
    visibility: 'public',
    order: 2,
    featured: true,
  },
  {
    id: 'attendance-system',
    name: 'Attendance System',
    description: 'An automated attendance tracking system with facial recognition.',
    longDescription: `An automated attendance tracking system with facial recognition.

**Tech Stack:** Python, OpenCV, FastAPI, PostgreSQL

**Features:**
- Face recognition check-in
- Real-time dashboard
- Export reports
- Multi-camera support`,
    technologies: ['Python', 'OpenCV', 'FastAPI', 'PostgreSQL'],
    githubUrl: '',
    liveUrl: '',
    featuredImage: '',
    visibility: 'public',
    order: 3,
    featured: true,
  },
];

export const DEFAULT_SKILLS: SkillConfig[] = [
  // Programming
  { id: 'typescript', name: 'TypeScript', category: 'programming', level: 'expert', order: 1, visibility: true },
  { id: 'javascript', name: 'JavaScript', category: 'programming', level: 'expert', order: 2, visibility: true },
  { id: 'python', name: 'Python', category: 'programming', level: 'advanced', order: 3, visibility: true },
  { id: 'go', name: 'Go', category: 'programming', level: 'advanced', order: 4, visibility: true },
  { id: 'rust', name: 'Rust', category: 'programming', level: 'intermediate', order: 5, visibility: true },
  { id: 'sql', name: 'SQL', category: 'programming', level: 'advanced', order: 6, visibility: true },

  // Web
  { id: 'react', name: 'React / Next.js', category: 'web', level: 'expert', order: 10, visibility: true },
  { id: 'vue', name: 'Vue.js', category: 'web', level: 'advanced', order: 11, visibility: true },
  { id: 'tailwind', name: 'Tailwind CSS', category: 'web', level: 'expert', order: 12, visibility: true },
  { id: 'threejs', name: 'WebGL / Three.js', category: 'web', level: 'advanced', order: 13, visibility: true },

  // Tools
  { id: 'docker', name: 'Docker / Kubernetes', category: 'tools', level: 'advanced', order: 20, visibility: true },
  { id: 'ci-cd', name: 'CI/CD (GitHub Actions, GitLab CI)', category: 'tools', level: 'advanced', order: 21, visibility: true },
  { id: 'terraform', name: 'Terraform', category: 'tools', level: 'intermediate', order: 22, visibility: true },

  // Infrastructure
  { id: 'aws', name: 'AWS / GCP', category: 'infrastructure', level: 'advanced', order: 30, visibility: true },

  // Databases
  { id: 'postgresql', name: 'PostgreSQL', category: 'databases', level: 'advanced', order: 40, visibility: true },
  { id: 'redis', name: 'Redis', category: 'databases', level: 'advanced', order: 41, visibility: true },
];

export const DEFAULT_EXPERIENCE: ExperienceConfig[] = [
  {
    id: 'exp-1',
    organization: '[Current/Recent Position]',
    role: 'Role',
    startDate: '2023-01',
    endDate: 'present',
    description: '- Achievement 1\n- Achievement 2\n- Achievement 3',
    technologies: [],
    link: '',
    order: 1,
    visibility: true,
  },
  {
    id: 'exp-2',
    organization: '[Previous Position]',
    role: 'Role',
    startDate: '2021-01',
    endDate: '2022-12',
    description: '- Achievement 1\n- Achievement 2',
    technologies: [],
    link: '',
    order: 2,
    visibility: true,
  },
];

export const DEFAULT_CERTIFICATES: CertificateConfig[] = [];

export const DEFAULT_ASSETS: AssetConfig[] = [
  {
    id: 'hero',
    name: 'Hero Image',
    category: 'image',
    assetPath: '/portfolio/images/hero.png',
    mimeType: 'image/png',
    size: 13057,
    featured: true,
    visibility: true,
    tags: ['hero', 'banner'],
    order: 1,
  },
  {
    id: 'react-logo',
    name: 'React Logo',
    category: 'image',
    assetPath: '/portfolio/images/react.svg',
    mimeType: 'image/svg+xml',
    size: 4126,
    featured: false,
    visibility: true,
    tags: ['logo', 'react'],
    order: 2,
  },
  {
    id: 'vite-logo',
    name: 'Vite Logo',
    category: 'image',
    assetPath: '/portfolio/images/vite.svg',
    mimeType: 'image/svg+xml',
    size: 8709,
    featured: false,
    visibility: true,
    tags: ['logo', 'vite'],
    order: 3,
  },
];

export const DEFAULT_SETTINGS: SettingsConfig = {
  configVersion: 1,
  lastModified: new Date().toISOString(),
  adminConfigured: true,
};

// Full default config
export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  appearance: DEFAULT_APPEARANCE,
  portfolio: DEFAULT_PORTFOLIO,
  projects: DEFAULT_PROJECTS,
  skills: DEFAULT_SKILLS,
  experience: DEFAULT_EXPERIENCE,
  certificates: DEFAULT_CERTIFICATES,
  assets: DEFAULT_ASSETS,
  settings: DEFAULT_SETTINGS,
};

// ============ ADMIN CONFIG INTERFACE ============

export interface AdminConfig {
  appearance: AppearanceConfig;
  portfolio: PortfolioConfig;
  projects: ProjectConfig[];
  skills: SkillConfig[];
  experience: ExperienceConfig[];
  certificates: CertificateConfig[];
  assets: AssetConfig[];
  settings: SettingsConfig;
}