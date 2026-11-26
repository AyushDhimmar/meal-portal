# Meal Portal – web app

React 19 + TypeScript + Vite, Mantine UI, Redux Toolkit + RTK Query, Supabase.

## Run locally

1. Start Docker Desktop, then from the repo root: `npx supabase start`
2. `web/.env.local` (copy from `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
3. In `web/`: `npm install`, then one of
   - `npm run dev` – http://127.0.0.1:3000
   - `npm run dev:proxy` – same, with Supabase reached through the dev server (for the in-app browser)
   - `npm run dev:lan` – https on the local network, for testing phones and the camera

`npm run build` type-checks and builds; `npm run lint` runs oxlint.

## Database types

`src/lib/database.types.ts` is generated from the database. Regenerate it after every migration
(from the repo root, PowerShell):

```powershell
npx supabase gen types typescript --local --schema public | Out-File -Encoding utf8 web/src/lib/database.types.ts
```

A wrong table, column or function name then fails the build instead of failing at runtime.

## Structure

```
src/
  app/          store, the single RTK Query api (api.ts), routes (App.tsx)
  features/     one folder per area: api.ts (endpoints), screens, schema.ts (Zod), styles
    auth/       sign-in, signed-in user (Redux slice), profile
    employees/  employee list, form, Excel/CSV import          (Admin)
    cycles/     lunch months, holidays, opt-in overrides       (Admin)
    dashboard/  any day's served vs expected, corrections, paper list (Admin)
    reports/    monthly bill and export                        (Admin)
    more/       audit log and settings                         (Admin)
    counter/    scan / code / name lookup, today's list        (Verifier)
    me/         home + opt-in, meal history, my code           (Employee)
  components/   shared UI (ReasonModal, RefreshButton, ErrorBoundary, …)
  lib/          supabase client, errors, dates (always Asia/Kolkata), shared Zod rules
  layout/       app shell and navigation
```

## Conventions

- **Server data:** RTK Query only. Each feature adds endpoints with `api.injectEndpoints`;
  calls go through `sb()` / `sbJson()` / `sbView()` in `app/api.ts`, which turn any error into
  an `AppError` with a readable message (`lib/errors.ts`).
- **Cache refresh:** mutations invalidate tags (`Employee`, `Cycle`, `Day`, `Bill`, `Audit`, …);
  queries that provide a tag refetch. There is no automatic polling: screens load when opened,
  after the user's own changes, and on the Refresh button.
- **Instant updates** (optimistic, undone on error) are used for holidays, opt-in overrides and
  the employee's own opt-in. Serving at the counter waits for the server.
- **Redux state** is only for state shared across screens (the signed-in user, the remembered
  profile for offline "My code"). Form inputs, filters and dialogs stay in components.
- **Forms:** Mantine Form + Zod schemas in each feature's `schema.ts`; the database enforces the
  same rules.
