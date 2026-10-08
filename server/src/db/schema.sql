-- MimiOS PostgreSQL Schema
-- Idempotent initialization for Supabase PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_content (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  technologies TEXT NOT NULL DEFAULT '[]',
  github_url TEXT,
  live_url TEXT,
  featured_image TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'hidden')),
  featured SMALLINT NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  github_repo TEXT,
  github_stars INTEGER NOT NULL DEFAULT 0,
  github_forks INTEGER NOT NULL DEFAULT 0,
  github_language TEXT,
  github_topics TEXT NOT NULL DEFAULT '[]',
  github_updated_at TEXT,
  github_sync_status TEXT NOT NULL DEFAULT 'not_synced' CHECK (github_sync_status IN ('not_synced', 'synced', 'failed')),
  github_synced_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visibility SMALLINT NOT NULL DEFAULT 1 CHECK (visibility IN (0, 1)),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS experience (
  id TEXT PRIMARY KEY,
  organization TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  description TEXT,
  technologies TEXT NOT NULL DEFAULT '[]',
  link TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visibility SMALLINT NOT NULL DEFAULT 1 CHECK (visibility IN (0, 1)),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('image', 'video', 'document')),
  asset_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  featured SMALLINT NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  visibility SMALLINT NOT NULL DEFAULT 1 CHECK (visibility IN (0, 1)),
  tags TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  asset_id TEXT,
  link TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visibility SMALLINT NOT NULL DEFAULT 1 CHECK (visibility IN (0, 1)),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT fk_certificates_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_skills_visibility ON skills(visibility);
CREATE INDEX IF NOT EXISTS idx_experience_visibility ON experience(visibility);
CREATE INDEX IF NOT EXISTS idx_certificates_visibility ON certificates(visibility);
CREATE INDEX IF NOT EXISTS idx_assets_visibility ON assets(visibility);
