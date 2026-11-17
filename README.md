# TransLogix

React + Vite + Tailwind frontend with a Node.js API, persistent storage, account sessions, and an optional OpenAI assistant. Vercel uses Neon PostgreSQL; local development defaults to SQLite.

## Run after cloning

Use Node.js **24 LTS** and pnpm. No separate database installation is needed for local development.

```sh
corepack enable
pnpm install
pnpm dev
```

Open the URL printed by Vite, normally **http://localhost:8443**. One command starts both the website and its API. In Figma Make the development server is already running.

On the first development start, the server creates `.data/translogix.sqlite` and these local example accounts:

| Role | Email |
| --- | --- |
| Administrator | admin@translogix.local |
| Operations staff | operations@translogix.local |
| Warehouse staff | warehouse@translogix.local |

Their initial local password is `TransLogixDemo!2026`. These are example accounts for local testing. Administrators can create individual accounts in Settings; users can change their own passwords. Account roles are checked by the API, and changing a role revokes that account's sessions.

The SQLite file persists orders, preparation, shipments, users, profiles, sessions, and activity across browser reloads and server restarts. `.data/` is ignored by Git. Keep a backup of this directory if its contents matter; cloning the repository creates a separate database on each computer.

## Connect the assistant

Create a private `.env.local` using the variable names in [.env.example](.env.example):

```dotenv
OPENAI_API_KEY=replace_with_your_own_new_key
OPENAI_MODEL=gpt-6-luna
```

Edit that file locally, then restart `pnpm dev`. Use a newly generated key if a key was shared in a chat or other document. The actual key belongs only in `.env.local` or a server secret manager. Never give it a `VITE_` prefix, put it in a React component, or commit it. The repository includes no real API credentials.

The server calls the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text) using `store: false`. Chat messages, the current page, the signed-in role, and relevant referenced order/shipment/product summaries are sent to OpenAI. Local chat history stays in browser memory and clears on sign-out or reload. This setting does not change OpenAI's other applicable data retention policies. The assistant can explain saved records and workflows; it cannot perform business actions. Without a configured key the website still works, and chat shows an unavailable state.

## Backend and integrations

The application API runs on the same origin as the frontend. Passwords are hashed with scrypt. Session tokens are stored as hashes in the database and sent in HttpOnly, SameSite cookies. Mutations require a same-origin request header; login and chat rate limits are persisted in the database and shared across Vercel instances. Setting `DATABASE_URL` selects PostgreSQL; leaving it empty in local development selects SQLite.

| Area | Routes |
| --- | --- |
| Session | `GET /api/auth/session`, `POST /api/auth/login`, `POST /api/auth/logout` |
| Workspace | `GET /api/v1/workspace` |
| Orders | `GET/POST /api/v1/orders`, `GET /api/v1/orders/:id` |
| Warehouse | `POST /api/v1/inventory/check`, `PUT /api/v1/orders/:id/preparation` |
| Shipments | `GET/POST /api/v1/shipments`, `POST /api/v1/shipments/:id/sync` |
| Recovery | `POST /api/v1/carrier/check` |
| Tracking | `GET /api/v1/tracking?reference=...` |
| Account | `PATCH /api/v1/profile`, `PATCH /api/v1/password` |
| Administration | `POST /api/v1/users`, `PATCH /api/v1/users/:id/role` |
| Assistant | `GET /api/chat/status`, `POST /api/chat` |
| Health | `GET /api/health` |

Orders accept `items: [{ sku, quantity }]`. The server validates required fields, known SKUs, positive integer quantities, and duplicate IDs. Creation returns 201, invalid input 400, and an existing order ID 409.

**Carrier, WMS, and OMS adapters are simulations.** They produce persistent example records, not real carrier bookings. The shipment form can demonstrate a success, timeout, carrier unavailability, or failed OMS synchronization. An unknown carrier outcome blocks creation until a status check confirms no shipment exists. Repeated shipment requests return the existing shipment. Synchronization retries retain the shipment and tracking reference. Availability checks do not reserve or deduct stock, and tracking refresh does not invent dispatch or delivery events.

Operations staff and administrators can create orders and shipments and retry synchronization. All authenticated roles can read operational records, check simulated stock, and save preparation. Only administrators can create users, change other users' roles, and receive integration technical details. The assistant uses the authenticated server role rather than a role supplied by the browser.

## Checks and built server

```sh
pnpm test:backend
pnpm test:postgres
pnpm test:theme
pnpm exec tsc --noEmit
pnpm build
```

To run the built full-stack app locally, create `.env.local` from the template, keep `SEED_DEMO_DATA=true` for local example accounts, then:

```sh
pnpm build
pnpm start
```

Open **http://127.0.0.1:3000**. `pnpm preview` also includes the API for local inspection. Uploading only `dist/` to static hosting will not run the backend.

For **Vercel and translogix.com**, follow [the Vercel setup guide](docs/vercel-setup.md). It describes Neon, private environment variables, the initial administrator, API routing, the supplied DNS record, and deployment verification. Vercel functions always use PostgreSQL and secure cookies and never seed the local demo accounts. No deployment or DNS changes are performed by these commands.

For a standalone Node server, use a persistent database volume or `DATABASE_URL`, HTTPS with `COOKIE_SECURE=true`, and `SEED_DEMO_DATA=false`. For an empty database also set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters). Bootstrap variables only create the initial account; use Settings to change an existing password.
