# PROJECT KEYSTONE — Field Service Management

A full-stack Field Service Management (FSM) platform with a **completely decoupled**
frontend and backend, ready for separate deployment.

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS (located in `/frontend`)
- **Backend**: Node.js + Express 5, serverless-ready, backed by **Supabase (PostgreSQL)** (located in `/api`)
- **Deployment**: The frontend and backend deploy as **two separate Vercel projects**.

```
├── frontend/    # React + TypeScript frontend (independent Vite project)
├── api/         # Node.js/Express backend (independent project, serverless-ready)
└── supabase_setup.sql   # Canonical Supabase schema + seed script
```

## Architecture

- `/frontend` and `/api` are **fully independent** projects. Each has its own
  `package.json`, its own dependencies, and its own run/build/deploy commands.
- The frontend never imports backend code and vice-versa.
- The backend exposes a REST API under the `/api` prefix. The frontend talks to it
  via the `VITE_API_URL` environment variable.
- Authentication uses short-lived JWT **access tokens** plus long-lived **refresh tokens**
  (stored in the `refresh_tokens` table for serverless compatibility).

### Demo users

| Username | Password | Role |
|----------|----------|------|
| `manager1` | `Manager@123` | Manager |
| `dispatcher1` | `Dispatcher@123` | Dispatcher |
| `tech1` / `tech2` | `Tech@123` | Technician |
| `customer1` | `Customer@123` | Customer |

Seed users, customers, sites, parts, work orders, history, time logs, stock movements
and notifications are created by `supabase_setup.sql`.

---

## Local Development

The two projects run independently. Open two terminals.

### 1. Backend (`/api`)

```bash
cd api
npm install

# Create your env file (fill in your Supabase credentials)
copy .env.example .env        # Windows
# cp .env.example .env         # macOS / Linux

npm run dev                   # starts on http://localhost:5000
```

Backend environment variables (`.env`):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (**server-side only**) |
| `ACCESS_TOKEN_SECRET` | JWT access-token secret (`openssl rand -hex 64`) |
| `REFRESH_TOKEN_SECRET` | JWT refresh-token secret (`openssl rand -hex 64`) |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins (defaults to `http://localhost:5173,http://localhost:5174`) |
| `PORT` | Local port (default `5000`) |
| `NODE_ENV` | `development` or `production` |

Health check: `GET /api/health` → `{ "status": "OK" }`

> **Database setup:** run `supabase_setup.sql` once in the Supabase SQL Editor.
> The `/api/db/migration` folder holds the versioned SQL source of truth.

### 2. Frontend (`/frontend`)

```bash
cd frontend
npm install

# Create your env file
copy .env.example .env        # Windows
# cp .env.example .env         # macOS / Linux

npm run dev                   # starts on http://localhost:5174
```

Frontend environment variable (`.env`):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend root URL. For local dev: `http://localhost:5000`. For production: your deployed backend URL. |

> During local development, set `VITE_API_URL=http://localhost:5000` (or leave it
> blank to rely on the Vite dev-server proxy, which is already configured to forward
> `/api` and `/ws` to `http://localhost:5000`).

Useful frontend commands:

```bash
npm run dev        # dev server on :5174
npm run build      # production build to dist/
npm run typecheck  # TypeScript type-check
npm run preview    # preview the production build
```

---

## Backend Deployment (separate Vercel project)

1. In the Vercel dashboard, click **Add New → Project**, and import your repo.
2. Choose the **`api`** directory as the **Root Directory**.
3. Vercel auto-detects the Node.js/Express serverless build via `api/vercel.json`
   and `api/package.json`. No build command is required.
4. Add the backend environment variables (Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ACCESS_TOKEN_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `CORS_ORIGIN` → set to `https://your-frontend.vercel.app` (your deployed frontend URL)
   - `NODE_ENV=production`
5. Deploy. Your backend URL will look like `https://your-backend.vercel.app`.
6. Verify it is live: open `https://your-backend.vercel.app/api/health` → `{ "status": "OK" }`.
7. **Copy your deployed backend URL** — you'll need it for the frontend.

> The Express app (`api/index.js`) exports the app for Vercel serverless and only calls
> `app.listen()` when run directly (`npm start` / `npm run dev`), so it is fully
> serverless-compatible.

---

## Frontend Deployment (separate Vercel project)

1. In Vercel, **Add New → Project** and import the same repo.
2. Choose the **`frontend`** directory as the **Root Directory**.
3. Vercel auto-detects Vite. `frontend/vercel.json` sets the build command
   (`npm run build`), output directory (`dist`), and SPA rewrites.
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add the frontend environment variable (Settings → Environment Variables):
   - `VITE_API_URL` → `https://your-backend.vercel.app`
5. Deploy.
6. **Update CORS:** make sure the backend `CORS_ORIGIN` includes your frontend's
   `.vercel.app` domain (or your custom domain).
7. **Redeploy the frontend** after changing `VITE_API_URL` — Vite bakes this value
   into the production bundle at build time.

---

## Environment Variables Summary

### Frontend (`.env.example`)
```
VITE_API_URL=http://localhost:5000
```

### Backend (`.env.example`)
```
PORT=5000
NODE_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

> Never put backend secrets (service-role key, JWT secrets) in the frontend. Only
> `VITE_API_URL` belongs in the frontend.

---

## API Overview

All endpoints are under the `/api` prefix (the frontend client appends this automatically).

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- **Work Orders**: `GET/POST /api/work-orders`, `GET /api/work-orders/:id`, `PATCH /api/work-orders/:id/status`, `POST /api/work-orders/:id/assign`, `GET /api/work-orders/kanban`, `GET /api/work-orders/:id/history`
- **Time Logs**: `GET /api/work-orders/:id/time-logs`, `POST /api/work-orders/:id/time-logs/start`, `POST /api/time-logs/:id/stop`, `GET /api/time-logs/my`
- **Customers**: `GET/POST /api/customers`, `PUT/DELETE /api/customers/:id`
- **Sites**: `GET/POST /api/sites`, `PUT/DELETE /api/sites/:id`
- **Parts & Stock**: `GET /api/parts`, `GET /api/parts/low`, `GET /api/parts/:id/movements`, `POST /api/parts/:id/stock`, `GET/POST /api/parts/work-orders/:workOrderId(/:consume)`
- **Notifications**: `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- **Users**: `GET /api/users`
- **Dashboard**: `GET /api/dashboard/metrics`
- **Health**: `GET /api/health`
