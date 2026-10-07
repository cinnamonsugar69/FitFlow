# FitFlow

Gym member issue tracking built with Next.js App Router, React, Tailwind CSS, and Supabase. `/` submits issues; `/issues` lists submissions and lets managers assign or resolve them. `lib/supabase.ts` connects the browser using a publishable key.

Staff sign in with email and password. Approved identities and roles live in `staff_profiles`; database policies enforce staff/manager access. This version serves a single gym using the existing department assignment labels.

## Setup

Follow [staff setup and deployment](docs/DEPLOYMENT.md) before using the app. The migration and two approved Auth accounts are required. Copy `.env.example` to `.env.local` and set the project URL and publishable key. Use Node.js 22.

```powershell
npm ci
npm run dev
```

Open http://localhost:3000.

## Checks

```powershell
npm run lint
npm test
npm run build
```

Permission tests use local PostgreSQL through PGlite and apply the actual migration. GitHub Actions runs all three checks. Live Supabase and two-user browser checks are described in the deployment guide.
