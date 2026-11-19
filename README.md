# TranceLogix

React + Vite + Tailwind frontend with a Node.js API, persistent storage, account sessions, and an optional OpenAI assistant. Netlify and Vercel use managed PostgreSQL; local development defaults to SQLite.

## Run after cloning

Use Node.js **24 LTS** and pnpm. No separate database installation is needed for local development.

```sh
corepack enable
pnpm install
pnpm dev
```

Open the URL printed by Vite, normally **http://localhost:8443**. One command starts both the website and its API. In Figma Make the development server is already running.

On the first development start, the server creates `.data/trancelogix.sqlite` and these local example accounts:

| Role | Email |
| --- | --- |
| Administrator | admin@trancelogix.local |
| Operations staff | operations@trancelogix.local |
| Warehouse staff | warehouse@trancelogix.local |

Their initial local password is `TranceLogixDemo!2026`. These are example accounts for local testing. Administrators can create individual accounts in Settings; users can change their own passwords. Account roles are checked by the API, and changing a role revokes that account's sessions.

Existing databases keep their passwords and records during the rename. The three built-in local account emails are updated to `@trancelogix.local`, while their previous email aliases still work. Existing browser sessions and theme preferences are accepted. The server reuses an existing pre-rename database file unless `DATABASE_PATH` explicitly selects another one; new databases use `.data/trancelogix.sqlite`.

The SQLite file persists orders, preparation, shipments, users, profiles, sessions, and activity across browser reloads and server restarts. `.data/` is ignored by Git. Keep a backup of this directory if its contents matter; cloning the repository creates a separate database on each computer.

## Connect the assistant

Create a private `.env.local` using the variable names in [.env.example](.env.example):

```dotenv
OPENAI_API_KEY=replace_with_your_own_new_key
OPENAI_MODEL=gpt-6-luna
```

Edit that file locally, then restart `pnpm dev`. Use a newly generated key if a key was shared in a chat or other document. The actual key belongs only in `.env.local` or a server secret manager. Never give it a `VITE_` prefix, put it in a React component, or commit it. The repository includes no real API credentials.

As an administrator, open **Settings → Integrations → Refresh setup → Test connection**. A configured key and a verified connection have separate labels. The connection test sends only a fixed, short diagnostic message to OpenAI; it includes no workspace records, user identity or conversation. Billing, model-access and credential errors receive actionable messages. Hosted sites need the key in their server environment variables and a redeploy; local `.env.local` files are not uploaded to Netlify.

The server calls the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text) using `store: false`. Chat messages, the current page, the signed-in role, and relevant referenced order/shipment/product summaries are sent to OpenAI. Local chat history stays in browser memory and clears on sign-out or reload. This setting does not change OpenAI's other applicable data retention policies. The assistant can explain saved records and workflows; it cannot perform business actions. Without a configured key the website still works, and chat shows an unavailable state.

## Destination maps

Select a city name in Orders, the warehouse preparation queue or Shipments to open its map drawer. Maps also appear alongside order, preparation and shipment details and within Tracking. **Explore map** enables panning; zoom controls, recentering and an external map link remain available. The marker represents an approximate city center, with no live vehicle position, route or delivery ETA implied.

[Leaflet](https://leafletjs.com/) displays [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles, with visible attribution. The authenticated API resolves city names through [Open-Meteo / GeoNames](https://open-meteo.com/en/docs/geocoding-api). City searches occur on opening a visible map or submitting a search, and are cached; typing alone sends no search request. Alternative matches can be selected without changing saved destinations. No map API key is needed for the current non-commercial project setup. Internet access is required for city lookup and tiles; provider failures leave the rest of the workflow available.

The public tile and geocoding services have usage policies; a commercial or higher-volume deployment should configure suitable provider access. Tile requests retain attribution, normal browser caching and a valid referrer. There is no bulk download or offline tile prefetch.

## Backend and integrations

The application API runs on the same origin as the frontend. Passwords are hashed with scrypt. Session tokens are stored as hashes in the database and sent in HttpOnly, SameSite cookies. Mutations require a same-origin request header; login and chat rate limits are persisted in the database and shared across hosted instances. Setting `DATABASE_URL` selects PostgreSQL; leaving it empty in local development selects SQLite.

| Area | Routes |
| --- | --- |
| Session | `GET /api/auth/session`, `POST /api/auth/login`, `POST /api/auth/logout` |
| Workspace | `GET /api/v1/workspace` |
| Orders | `GET/POST /api/v1/orders`, `GET /api/v1/orders/:id` |
| Warehouse | `POST /api/v1/inventory/check`, `PUT /api/v1/orders/:id/preparation` |
| Shipments | `GET/POST /api/v1/shipments`, `POST /api/v1/shipments/:id/sync` |
| Recovery | `POST /api/v1/carrier/check` |
| Tracking | `GET /api/v1/tracking?reference=...` |
| Destination maps | `GET /api/v1/locations?city=...` (signed-in accounts) |
| Account | `PATCH /api/v1/profile`, `PATCH /api/v1/password` |
| Administration | `POST /api/v1/users`, `PATCH /api/v1/users/:id/role`, `DELETE /api/v1/users/:id` |
| Assistant | `GET /api/chat/status`, `POST /api/chat`, `POST /api/chat/check` (administrator diagnostic) |
| Health | `GET /api/health` |

Orders accept `items: [{ sku, quantity }]`. The server validates required fields, known SKUs, positive integer quantities, and duplicate IDs. Creation returns 201, invalid input 400, and an existing order ID 409.

**Carrier, WMS, and OMS adapters are simulations.** They produce persistent example records, not real carrier bookings. The shipment form can demonstrate a success, timeout, carrier unavailability, or failed OMS synchronization. An unknown carrier outcome blocks creation until a status check confirms no shipment exists. Repeated shipment requests return the existing shipment. Synchronization retries retain the shipment and tracking reference. Availability checks do not reserve or deduct stock, and tracking refresh does not invent dispatch or delivery events.

Operations staff and administrators can create orders and shipments and retry synchronization. All authenticated roles can read operational records, check simulated stock, and save preparation. Only administrators can create users, change other users' roles, delete other users, and receive integration technical details. The assistant uses the authenticated server role rather than a role supplied by the browser.

In **Settings → Users and roles**, an administrator can select **Delete user** and confirm the named account. Deletion permanently removes the account and revokes its sessions while preserving orders, shipments, and existing activity history. The active account and the last administrator are protected. Deletions are recorded in the activity history, and permission checks run again inside the database transaction to prevent concurrent administrators from deleting each other.

## Checks and built server

```sh
pnpm test:backend
pnpm test:postgres
pnpm test:netlify
pnpm test:theme
pnpm test:locations
pnpm exec tsc --noEmit
pnpm build
```

To run the built full-stack app locally, create `.env.local` from the template, keep `SEED_DEMO_DATA=true` for local example accounts, then:

```sh
pnpm build
pnpm start
```

Open **http://127.0.0.1:3000**. `pnpm preview` also includes the API for local inspection. Uploading only `dist/` to static hosting will not run the backend.

For **TranceLogix on Netlify**, follow [the Netlify setup guide](docs/netlify-setup.md). The committed `netlify.toml` builds the frontend and deploys `netlify/functions/api.ts` for `/api/*`. Connect the Git repository so both the frontend and function deploy; a manual upload of only `dist/` cannot run login. Set `DATABASE_URL`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` privately in Netlify with Functions access, then redeploy. Hosted login uses your database accounts, not the local demo accounts.

The [Vercel setup guide](docs/vercel-setup.md) remains available for that host. Both hosted adapters require PostgreSQL and secure cookies and disable local demo seeding. These local build commands do not deploy the site or change cloud settings.

For a standalone Node server, use a persistent database volume or `DATABASE_URL`, HTTPS with `COOKIE_SECURE=true`, and `SEED_DEMO_DATA=false`. For an empty database also set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters). Bootstrap variables only create the initial account; use Settings to change an existing password.
