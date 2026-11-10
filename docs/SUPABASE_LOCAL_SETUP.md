# Supabase configuration for the creator/retailer dashboard

Supabase is required for this branch's dashboard authentication, profiles and PostgreSQL-backed views. It is not required for the Chrome extension's existing recognition, discovery or Sandbox checkout. No service-role key is used by this integration.

Your existing root `.env` is preserved. Put dashboard credentials in the two ignored local files below. They are separate because Vite loads environment from the dashboard directory and the Retail API's start/seed commands load `.env` from the Retail API directory.

## Values to supply

Use one Supabase project for all three values:

1. Project URL, such as `https://<project-ref>.supabase.co`.
2. Public publishable key or legacy `anon` key for that project. Never use the service-role/secret key.
3. PostgreSQL connection string, including the database password. This is a database credential, not an API key. Use a direct connection or session-pooler connection reachable by your machine and URL-encode special characters in the password. Keep TLS verification enabled; use the project's CA certificate if your connection requires it.

In `C:/hackthons/BopIt/apps/dashboard/.env` fill:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-publishable-or-anon-key>
```

In `C:/hackthons/BopIt/apps/retail-api/.env` fill:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<same-public-publishable-or-anon-key>
RETAIL_STORAGE=postgres
RETAIL_DATABASE_URL=<postgresql-connection-string-with-database-password>
```

The database password belongs only in the Retail API file. No Gemini, Channel3 or PayPal secret should go in any `VITE_*` variable. The dashboard's public key is browser-visible by design; access control depends on Auth and the migration's RLS policies.

## Database and Auth setup

Use a dedicated BopIt project/database: the signup trigger applies to new Auth users in this project. Apply these SQL files in order before registering dashboard users:

1. `apps/dashboard/db/migrations/001_retail_foundation.sql`
2. `apps/dashboard/db/migrations/002_supabase_dashboard_auth.sql`
3. `apps/dashboard/db/migrations/003_dashboard_demo_data.sql`

Enable email/password sign-in and configure the dashboard site URL as `http://127.0.0.1:5173`, with allowed callback `http://127.0.0.1:5173/auth/callback`. Use the same hostname throughout. Complete email confirmation when registering; the API requires a confirmed account. Accounts created before the profile trigger will need separate profile provisioning.

## Run locally (PowerShell)

Terminal one:

```powershell
Set-Location C:/hackthons/BopIt/apps/retail-api
npm ci
npm start
```

Terminal two:

```powershell
Set-Location C:/hackthons/BopIt/apps/dashboard
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` and register a Creator or Retailer. To populate explicitly labeled synthetic sample data after registration:

```powershell
Set-Location C:/hackthons/BopIt/apps/retail-api
npm run seed:demo
```

For live product search, also start the root recognition server with its existing Channel3 configuration and pairing token. Dashboard reporting/subscription access remains blocked until dashboard account ownership is linked to extension installation identity. SQLite CSV imports/analytics are a separate pipeline and are not implemented by these PostgreSQL migrations.

Restart the Retail API and Vite after changing environment values. A production dashboard build needs these Vite values at build time and a separately configured production API/proxy. The local Vite proxy is not a production gateway.

Live migrations, email delivery and database RLS still need verification against your supplied project. Local automated tests use provider mocks and do not prove that project is configured.
