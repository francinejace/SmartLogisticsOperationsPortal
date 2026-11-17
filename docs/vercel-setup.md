# TranceLogix on Vercel

The deployment uses Vercel for the React frontend and Node.js API, with Neon PostgreSQL for persistent storage. Local development uses SQLite when `DATABASE_URL` is empty.

## 1. Connect the database

In the Vercel project, open **Storage / Marketplace**, select **Neon**, and connect a PostgreSQL database to this project. Use a region near the project's Vercel Functions. The integration supplies `DATABASE_URL`; use the pooled connection URL. Keep preview deployments connected to a separate database/branch rather than the production database.

Official instructions: [Neon's Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration).

## 2. Set private environment variables

Set these in the Vercel project's **Settings → Environment Variables**, for the intended environment:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string, normally supplied by the integration |
| `BOOTSTRAP_ADMIN_EMAIL` | The initial administrator's email |
| `BOOTSTRAP_ADMIN_PASSWORD` | A private password of 12–200 characters |
| `OPENAI_API_KEY` | A newly generated private OpenAI key, if using the chatbot |
| `OPENAI_MODEL` | `gpt-6-luna` |

Vercel API functions enforce secure session cookies and disable demo-account seeding. The bootstrap credentials only create the first administrator in an empty database. After signing in, create individual accounts in Settings. Change an existing password through Settings rather than changing bootstrap variables.

Never prefix secret variables with `VITE_`. Never paste credentials into source files, GitHub commits, screenshots, or shared documentation. Rotate any key previously shared in a conversation. Environment variable changes take effect on a new deployment.

## 3. Build and API routing

The committed `vercel.json` specifies the Vite framework, `pnpm build`, `dist` output, and routing from `/api/*` to `api/index.ts`. The Node runtime is pinned to 24 in `package.json`. Both the frontend and API stay on the same origin, so login cookies and API calls work on the Vercel preview URL and on the project's assigned `.vercel.app` address without hard-coded backend URLs or broad CORS rules.

The first API request initializes the database schema and administrator inside a transaction. PostgreSQL advisory locks protect initialization and writes across function instances. The pool is registered with Vercel's connection lifecycle helper. Login and chat rate-limit counters are persisted in the database. If `DATABASE_URL` is absent, the function returns an actionable 503 response and does not fall back to an ephemeral filesystem database.

Database and API behavior have local SQLite and embedded PostgreSQL tests. A hosted Neon connection, Vercel deployment, and production login still require verification in the actual project.

## 4. Use the Vercel project address

Use the production address shown in the renamed project's **Settings → Domains**. A project named `trancelogix` may use `https://trancelogix.vercel.app` if that address is assigned and available; copy the actual address from Vercel rather than assuming it.

The website's canonical URL and Open Graph URL follow the current hosting origin, and API calls stay relative to it. Renaming the project requires no hard-coded domain change in the app. Keep the existing `noindex` setting until the site is ready for public indexing.

No purchased domain or external DNS changes are needed for a `.vercel.app` address. A custom domain requires ownership or the owner's permission; adding a name to this repository does not register or connect it.

Official instructions: [Vercel domains](https://vercel.com/docs/domains/working-with-domains).

## 5. Verify the deployment

After deploying, open `/api/health` and confirm a successful response. Sign in with the administrator account, create a user and an order, reload, and confirm the saved records remain. Test sign-out and a restricted staff account. Configure the new OpenAI key, open the assistant, and verify a real reply and an error/retry state.

Carrier, WMS, and OMS adapters remain explicitly simulated. They do not book real deliveries or connect to external warehouse/order systems. Switching from a local SQLite database to Neon starts a separate database; local data is not uploaded or migrated automatically.
