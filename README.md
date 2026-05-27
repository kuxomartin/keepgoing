# KeepGoing — Personal Coach Dashboard

A personal analytics dashboard that imports health, weight, and activity data from Google Sheets (Apple Health export + Strava export) into Supabase, and presents it as a daily-updated dashboard with recovery scores, weight trends, and activity history.

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Supabase** (Postgres + Auth + RLS)
- **Google Sheets API v4** (Service Account, server-only)
- **Vercel** (hosting + cron)

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/keepgoing.git
cd keepgoing
npm install
```

### 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Fill in all values (see **Environment Variables** section below).

### 3. Run Supabase migrations

Open your Supabase project → SQL Editor → run each migration file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_data_import_logs.sql
supabase/migrations/004_weight_logs_unique.sql
supabase/migrations/005_google_sheet_imports.sql
supabase/migrations/006_activities_unique.sql
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-only, never expose to browser** |
| `GOOGLE_CLIENT_EMAIL` | Service account email (e.g. `importer@project.iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | Service account private key (full PEM with literal `\n` newlines) |
| `CRON_SECRET` | Any long random string — protects the cron endpoint |

### Finding your Supabase keys

Supabase Dashboard → Project Settings → API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

### `GOOGLE_PRIVATE_KEY` formatting

The key must be stored with literal `\n` characters (not real newlines). When pasting into Vercel's dashboard, paste the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. Vercel handles multiline values correctly when pasted as-is.

In `.env.local`, wrap in double quotes:
```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

---

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run all 6 migration files in order (see Local Setup step 3)
3. Auth is email + password. Users sign up via the `/login` page
4. RLS policies ensure users only see their own data

---

## Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Google Sheets API** (APIs & Services → Enable APIs)
4. Create a **Service Account** (IAM & Admin → Service Accounts → Create)
5. Create a JSON key for the service account (Actions → Manage keys → Add key → JSON)
6. From the JSON file, copy:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`
7. **Share your Google Sheet** with the service account email (read-only is sufficient)

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/keepgoing.git
git add .
git commit -m "Initial production deployment"
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Add all environment variables (see below)
5. Click **Deploy**

### 3. Environment variables to set in Vercel

In Vercel → Project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL        = https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
GOOGLE_CLIENT_EMAIL             = importer@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY              = -----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
CRON_SECRET                     = (any long random string, e.g. output of: openssl rand -hex 32)
```

### 4. Cron job

`vercel.json` configures the cron automatically:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-google-sheets",
      "schedule": "0 3 * * *"
    }
  ]
}
```

This runs daily at **03:00 UTC**. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` with each cron invocation.

> **Note:** Cron jobs require a **Vercel Pro** plan or higher.

### 5. Test the cron manually after deployment

```bash
curl -s \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/sync-google-sheets | jq
```

Expected response:

```json
{
  "configs_processed": 3,
  "successful": 3,
  "failed": 0,
  "rows_imported_total": 450,
  "results": [...]
}
```

---

## Configuring Imports (Settings Page)

1. Sign in and navigate to **/settings**
2. Under **Google Sheets**, click the quick-add preset buttons:
   - **Apple Health Daily Metrics** — health metrics tab
   - **Apple Health Weight** — weight log tab
   - **Strava Activities** — Strava export tab
3. Click **Preview columns** to verify field mapping before syncing
4. Click the **▶ Sync** button per import (or **Sync All**)
5. The cron will keep data fresh daily at 03:00 UTC from that point on

---

## Supported Data Types

| `data_type` | Target table | Required columns |
|---|---|---|
| `health_metrics` | `health_metrics` | `date` |
| `weight_logs` | `weight_logs` | `date`, `weight_kg` |
| `strava_activities` | `activities` | `ID`, `Dátum`, `Typ`, `Názov` |

Supports Slovak and English column names. Supports comma-as-decimal numbers, kg/% suffixes, ISO and European date formats.

---

## Project Structure

```
app/
  (auth)/login/        Sign in / sign up
  (dashboard)/         Protected dashboard pages
  api/
    integrations/google-sheets/
      imports/         CRUD for import configs
      preview/         Column preview
      sync/            Manual sync trigger
    cron/sync-google-sheets/  Daily automated sync

lib/
  integrations/google-sheets/
    client.ts          Google Sheets API (server-only)
    mapper.ts          Column alias resolution
    parser.ts          Row parsing for all data types
    sync.ts            Sync orchestration + runImport()
  supabase/            client.ts, server.ts (+ createAdminClient)
  env.ts               Runtime env var validation

components/
  settings/import-manager.tsx   Multi-import manager UI
  charts/                       Recharts components
  ui/                           Hand-written Tailwind components

supabase/migrations/            All 6 SQL migration files
```
