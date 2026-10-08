# MimiOS — Production Deployment Guide (Render Free & Supabase)

This document provides step-by-step instructions for deploying MimiOS to **Render Free** with **Supabase PostgreSQL** for persistent relational storage and **Supabase Storage** for persistent binary assets.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Visitor's Browser                    │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       Static Assets (HTML/JS/CSS)       │ REST API & Cookies
                │                        │
┌───────────────▼───────────────┐ ┌──────▼───────────────┐
│     Render Static Site        │ │  Render Web Service  │
│      (React 19 + Vite)        │ │  (Fastify 5 Backend) │
│  Dist: dist/                  │ │  Node >=22 (0.0.0.0) │
└───────────────────────────────┘ └──────┬───────┬───────┘
                                         │       │
                  PostgreSQL Pool (6543) │       │ Storage API (HTTPS)
                                         │       │
                                  ┌──────▼──┐ ┌──▼───────────────┐
                                  │ Supabase│ │ Supabase Storage │
                                  │ Postgres│ │ (mimios-assets)  │
                                  └─────────┘ └──────────────────┘
```

- **Frontend (Web Desktop UI):** Built with React 19, TypeScript, and Vite. Deployed as a high-performance **Render Static Site**.
- **Backend API:** Fastify 5 REST server running on a **Render Web Service** container. Operates stateless with ephemeral container disk.
- **Database:** Supabase managed **PostgreSQL 17** via connection pooling (PgBouncer transaction pooler on port 6543).
- **Persistent Assets:** Supabase Storage public bucket (`mimios-assets`) for uploaded wallpapers, images, and documents.

---

## 2. Prerequisites

1. **Supabase Project:** Created at [supabase.com](https://supabase.com).
2. **Render Account:** Created at [render.com](https://render.com).
3. **GitHub Repository:** Pushed repository with the current code.

---

## 3. Supabase Infrastructure Setup

### A. Database Tables & Indexes
1. In the Supabase Dashboard, navigate to **SQL Editor**.
2. Open [`server/src/db/schema.sql`](file:///D:/Project/Portfolio/pratyushos/server/src/db/schema.sql) from the repository.
3. Paste the contents into the SQL Editor and click **Run**.
4. The script creates all 9 application tables idempotently:
   - `users` (Admin account credentials & roles)
   - `sessions` (Server-side signed sessions)
   - `portfolio_content` (Markdown portfolio copy)
   - `projects` (Featured showcase applications)
   - `skills` (Proficiency tags & categorizations)
   - `experience` (Career timeline entries)
   - `certificates` (Accreditations & verification links)
   - `assets` (Asset metadata & Supabase public CDN URLs)
   - `site_config` (Key-value appearance & wallpaper parameters)

### B. Supabase Storage Bucket
1. In the Supabase Dashboard, navigate to **Storage** → **Buckets**.
2. Click **New bucket**:
   - **Name:** `mimios-assets`
   - **Public bucket:** **Toggle ON (Enabled)**
   - **Allowed MIME types:** Optional (images, documents)
   - **File size limit:** `50 MB` (matches `UPLOAD_MAX_SIZE`)
3. Save the bucket.
4. Verify bucket accessibility: files uploaded to `mimios-assets` can be served publicly via URL format:
   `https://<project-ref>.supabase.co/storage/v1/object/public/mimios-assets/<filename>`

---

## 4. Backend Deployment (Render Web Service)

1. On the Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:

| Setting | Value |
|---|---|
| **Name** | `mimios-api` (or chosen name) |
| **Region** | Choose nearest to your Supabase region (e.g., Oregon / Ohio / Frankfurt) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

4. Under **Advanced**, set **Health Check Path** to:
   ```
   /health
   ```

5. Configure **Environment Variables** in Render:

| Variable | Recommended / Required Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security & caching |
| `HOST` | `0.0.0.0` | Required for Render routing |
| `PORT` | `10000` | Render assigns default port (or use `process.env.PORT`) |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require` | Supabase Transaction Pooler URL |
| `DIRECT_URL` | `postgresql://postgres:[pwd]@db.[ref].supabase.co:5432/postgres?sslmode=require` | Supabase Direct Connection URL |
| `SUPABASE_URL` | `https://[ref].supabase.co` | Your Supabase project API base URL |
| `SUPABASE_SECRET_KEY` | `sbp_...` or service role key | Secret key for storage management |
| `SUPABASE_STORAGE_BUCKET`| `mimios-assets` | Target storage bucket |
| `SESSION_SECRET` | `[generate 64-character random string]` | Secret for Fastify cookie signature |
| `ADMIN_EMAIL` | `admin@mimios.local` | Primary administrator account |
| `ADMIN_PASSWORD` | `[generate strong password >= 12 chars]` | Bcrypt hashed at startup |
| `CORS_ORIGIN` | `https://mimios.onrender.com,http://localhost:5173` | Comma-separated allowed frontend origins |
| `UPLOAD_MAX_SIZE` | `52428800` | 50 MB binary limit |
| `GITHUB_TOKEN` | *(Optional)* | Personal access token for GitHub proxy rate limit |
| `GITHUB_USERNAME` | `pratyushrobert` | Target GitHub profile |

6. Click **Create Web Service**.

---

## 5. Frontend Deployment (Render Static Site)

1. On the Render Dashboard, click **New +** → **Static Site**.
2. Connect the same GitHub repository.
3. Configure the settings:

| Setting | Value |
|---|---|
| **Name** | `mimios-app` (or chosen custom domain) |
| **Branch** | `main` |
| **Root Directory** | `.` (Repository root) |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

4. Under **Redirects / Rewrites**:
   - **Source:** `/*`
   - **Destination:** `/index.html`
   - **Action:** `Rewrite` (ensures client-side React routing functions smoothly)

5. Configure Frontend Environment Variables:

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://mimios-api.onrender.com` | URL of your deployed backend Web Service |

---

## 6. Render Free Tier Considerations & Optimizations

### A. Ephemeral Disk Immunity
On Render Free, the local filesystem is ephemeral and wiped upon redeploys or instance restarts.
- **Database:** Supabase PostgreSQL is external and persistent.
- **Uploads:** All wallpapers and assets upload directly to Supabase Storage.
- **Backward Compatibility:** Legacy `/uploads/:filename` requests receive an automatic `302 Found` redirect to Supabase CDN.

### B. Instance Spin-Down (Inactivity Sleep)
Render Free instances spin down after 15 minutes of inactivity:
- When a user visits the portfolio, the initial backend request may incur a **30–50 second cold-start latency**.
- The frontend includes offline and cached states for the VirtualFS and portfolio data to remain interactive during cold starts.
- An external uptime monitor (e.g. UptimeRobot, Cron-job.org) can optionally ping the `GET /health` endpoint every 10 minutes to maintain active warm instances.

---

## 7. Rollback & Local Development Fallback

### A. Local Development Mode
For offline development without internet access or Supabase credentials:
- If `DATABASE_URL` is omitted, the backend automatically falls back to local SQLite at `server/data/mimios.db`.
- The original SQLite database is preserved in `server/data/mimios.db`.

### B. Rollback Plan
If you need to revert from Supabase back to local SQLite:
1. Re-add `better-sqlite3` and `@types/better-sqlite3` via `npm install`.
2. Clear the `DATABASE_URL` environment variable.
3. The server initialization automatically selects the SQLite adapter when no connection string is supplied.

---

## 8. Post-Deployment Verification Checklist

- [ ] `GET /health` returns `{ "status": "ok", "timestamp": ... }` with HTTP 200.
- [ ] `GET /api/portfolio` returns public portfolio data.
- [ ] `GET /api/config` returns wallpaper configurations.
- [ ] `GET /uploads/90cd5452-a5dd-4268-8d29-c40241483256.png` returns HTTP 302 redirecting to Supabase CDN.
- [ ] Admin Portal login functions using the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- [ ] New asset upload in Admin Portal persists to Supabase Storage bucket `mimios-assets`.
- [ ] VirtualFS and terminal utilities load and operate smoothly.
