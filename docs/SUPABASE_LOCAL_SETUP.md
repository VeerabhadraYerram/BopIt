# Supabase configuration for the creator/retailer dashboard

Supabase provides dashboard authentication, profiles, and PostgreSQL storage. The Chrome extension and PayPal Sandbox checkout run independently. Use Node.js 22 and a dedicated Supabase project for this walkthrough.

Your existing root `.env` is preserved. Put dashboard credentials in the two ignored local files below. They are separate because Vite loads environment from the dashboard directory and the Retail API's start/seed commands load `.env` from the Retail API directory.

## Values to supply

Use one Supabase project for all three values:

1. The project URL from your Supabase project settings.
2. Public publishable key or legacy `anon` key for that project. Never use the service-role/secret key.
3. PostgreSQL connection string, including the database password. This is a database credential, not an API key. Use a direct connection or session-pooler connection reachable by your machine and URL-encode special characters in the password. Keep TLS verification enabled; use the project's CA certificate if your connection requires it.

Copy `apps/dashboard/.env.example` to `apps/dashboard/.env` and set:

- `VITE_SUPABASE_URL` to the project URL.
- `VITE_SUPABASE_ANON_KEY` to the public publishable or legacy anon key.

Copy `apps/retail-api/.env.example` to `apps/retail-api/.env` and set:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the same project URL and public key.
- `RETAIL_STORAGE` to `postgres`.
- `RETAIL_DATABASE_URL` to the PostgreSQL connection string.

The database password belongs only in the Retail API file. No Gemini, Channel3 or PayPal secret should go in any `VITE_*` variable. The dashboard's public key is browser-visible by design; access control depends on Auth and the migration's RLS policies.

## Database and Auth setup

In your Supabase project's SQL Editor, run the contents of each file in this order before registering dashboard users:

1. `apps/dashboard/db/migrations/001_retail_foundation.sql`
2. `apps/dashboard/db/migrations/002_supabase_dashboard_auth.sql`
3. `apps/dashboard/db/migrations/003_dashboard_demo_data.sql`

Enable email/password sign-in and configure the dashboard site URL as `http://127.0.0.1:5173`, with allowed callback `http://127.0.0.1:5173/auth/callback`. Use the same hostname throughout. Complete email confirmation when registering; the API requires a confirmed account. Accounts created before the profile trigger will need separate profile provisioning.

## Run locally

Open two terminals at the repository root. In terminal one:

```sh
cd apps/retail-api
npm ci
npm start
```

Terminal two:

```sh
cd apps/dashboard
npm ci
npm run dev
```

Open [the dashboard](http://127.0.0.1:5173) and register a Creator. Register a separate Retailer account if you want to review both workspaces. Confirm each email address and sign in. From a third terminal at the repository root, seed sample data for the registered profiles:

```sh
cd apps/retail-api
npm run seed:demo
```

Refresh the Creator dashboard and open **Channel3 → Moments that sell**. A populated table with a demo data label confirms that the account can read its seeded records. Open **Interest & drop-off** for the next view in the demo. If the table is empty, check the seed output and confirm both apps use the same Supabase project.

For live product search, also start the root recognition server with its existing Channel3 configuration and pairing token. Dashboard reporting/subscription access remains blocked until dashboard account ownership is linked to extension installation identity. SQLite CSV imports/analytics are a separate pipeline and are not implemented by these PostgreSQL migrations.

Restart the Retail API and Vite after changing environment values. A production dashboard build needs these Vite values at build time and a separately configured production API/proxy. The local Vite proxy is not a production gateway.

Live migrations, email delivery and database RLS still need verification against your supplied project. Local automated tests use provider mocks and do not prove that project is configured.

## Missing database certificate

If the API reports `ENOENT` while parsing `RETAIL_DATABASE_URL`, check whether its `sslrootcert` parameter references an existing certificate file. Download your project's server root certificate from Supabase Dashboard → Database Settings → SSL Configuration, save it locally, and set `sslrootcert` to its absolute path in `apps/retail-api/.env`. Keep `sslmode=verify-full`. See [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

On Windows, use forward slashes in the absolute certificate path. URL-encode the path if it contains spaces or reserved characters, then restart the API.
