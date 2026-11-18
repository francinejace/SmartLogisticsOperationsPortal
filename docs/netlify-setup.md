# TranceLogix on Netlify

Netlify must deploy both the Vite frontend and the API function. The Vercel `api/index.ts` entry point is not a Netlify Function. Uploading only the `dist/` folder leaves `/api/auth/login` without a backend, producing an HTML 404 or frontend page where the browser expects JSON.

## Connect the repository and database

Import the GitHub repository into the existing Netlify project, or connect it under the project's continuous deployment settings. Use the repository root as the base directory. The committed `netlify.toml` supplies:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Build Node.js version | `24` |
| Package manager for installation | pnpm `10.11.0` |

Connect a managed PostgreSQL database such as Neon and obtain its pooled connection URL. To retain an existing hosted workspace, use its existing PostgreSQL database. A new database starts a separate workspace; local SQLite records are not uploaded automatically. Use separate databases for production and deploy previews.

## Configure private variables

In the Netlify project's environment variables, set the following for the production deploy context. If scopes are offered, include **Functions**. Variables configured only in Vercel or in a private local `.env.local` are not automatically available on Netlify.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your pooled PostgreSQL connection string |
| `BOOTSTRAP_ADMIN_EMAIL` | Your chosen administrator email for a new, empty database |
| `BOOTSTRAP_ADMIN_PASSWORD` | Your private administrator password, 12–200 characters |
| `OPENAI_API_KEY` | Optional, your private OpenAI key for the assistant |
| `OPENAI_MODEL` | Optional, `gpt-6-luna` |

Keep private values in Netlify's UI, never in `netlify.toml` or variables prefixed with `VITE_`. Node.js 24 is selected for the build; to explicitly override the function runtime, set `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` in the Netlify UI. Environment or runtime changes require a new deploy.

The initial administrator is created only when the connected database has no users. An existing database keeps its accounts and passwords. Changing bootstrap variables does not reset an existing account. The public local demo credentials do not create hosted accounts, even if `SEED_DEMO_DATA=true` is copied into Netlify.

## Deploy and verify

Push the changes to the connected production branch and wait for Netlify's deploy to publish. The deploy's Functions list should contain **api**. The function declares `/api` and `/api/*` as custom paths, which Netlify evaluates before the frontend fallback. API requests remain on the same origin as the browser and never proxy through the old Vercel deployment.

1. Open `https://trancelogix.netlify.app/api/health`. With a connected database, it returns JSON containing `"ok": true` and `"database": "connected"`.
2. Open `/api/auth/session` before login. Expect JSON containing `"user": null`, not HTML.
3. Sign in using the administrator credentials for the connected database. Confirm the workspace loads and remains signed in after reload.
4. Create an order, reload, and confirm it remains saved. Sign out and verify the session ends.

| Result | Action |
| --- | --- |
| HTML 404 or the homepage at `/api/health` | Confirm the repository deploy includes `netlify/functions/api.ts`, `server/`, dependencies, and `netlify.toml`. Uploading only `dist/` is insufficient. Remove any old forced `/api/*` redirects to HTML or Vercel. |
| JSON `backend_not_configured` | Add `DATABASE_URL` with Functions access for the correct deploy context, then redeploy. |
| JSON `backend_unavailable` | Check the **api** function's logs, database reachability, and first-administrator settings for an empty database. |
| JSON `invalid_credentials` | Use the account stored in the connected PostgreSQL database. Local SQLite demo credentials are separate. |

Session cookies use HttpOnly, SameSite=Strict, Secure, and the current host. Login rate limits use Netlify's trusted client IP and are stored in PostgreSQL. Carrier, warehouse, and OMS integrations remain simulations.

## Local checks

`pnpm dev` continues to run the website and API locally with SQLite by default. `pnpm test:netlify` exercises the actual Web Request/Response adapter with PostgreSQL semantics, cookie round trips, login, saved records, origin validation, rate limits, body limits, and chat cancellation. It does not require a hosted database or real OpenAI key.

To validate Netlify's function packaging without deploying:

```sh
npx netlify-cli build --offline
```

Official references: [Function routing and build configuration](https://docs.netlify.com/build/functions/configuration/), [private function environment variables](https://docs.netlify.com/build/functions/environment-variables/), and [Netlify's Lambda adapter](https://docs.netlify.com/build/functions/api/#netlifyaws-lambda-compat).
