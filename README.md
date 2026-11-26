# Meal Portal

Subsidised lunch for 1rivet employees: employees opt in per month, the counter verifies and
serves, Admins manage months, people, corrections and the monthly bill.

| Folder | What |
|---|---|
| `supabase/` | Database: migrations (tables, security rules, functions), local seed data |
| `web/` | Web app (React + TypeScript + Vite), see `web/README.md` |
| `samples/` | Sample HR files for the employee import |

## Run locally

Requires Docker Desktop and Node.js 22+.

```powershell
npm install                 # Supabase CLI
npx supabase start          # local database + API (Docker)
cd web
copy .env.example .env.local  # then paste the publishable key printed by `supabase start`
npm install
npm run dev                 # http://127.0.0.1:3000
```

Test accounts (local seed only): `test.admin@1rivet.com`, `test.verifier@1rivet.com`,
`test.employee@1rivet.com`. Create their passwords in Supabase Studio → Authentication.

## Roles

- **Employee** (everyone): opt in or out for next month, meal history and bill, lunch code.
- **Verifier**: the lunch counter (scan, code or name search) and today's list.
- **Admin**: dashboard, lunch months, employees, monthly report, audit log and settings.
