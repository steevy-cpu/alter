# Alter

An AI life simulation game where you create an AI version of yourself, then watch — not control — that AI self live its own life in a shared world alongside other players' AI selves.

## Overview

You build your **Alter** by answering questions about who you are: your identity, personality, goals, fears, and the future you want. Once created, your Alter wakes up in a shared world and begins to live — making plans, encountering events, forming relationships, and reflecting on its days. A server-side simulation advances the world on a fixed tick, and updates stream to your dashboard in real time over WebSockets. You observe; you don't steer.

## Tech Stack

**Backend**
- Python + [FastAPI](https://fastapi.tiangolo.com/) (ASGI, async)
- [APScheduler](https://apscheduler.readthedocs.io/) — the simulation tick scheduler
- [Supabase](https://supabase.com/) (Postgres + Auth + `pgvector`) for data, auth, and semantic memory
- [Anthropic Claude](https://www.anthropic.com/) — the reasoning core of each Alter
- WebSockets for real-time updates

**Frontend**
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [React Router](https://reactrouter.com/) for routing
- [Zustand](https://github.com/pmndrs/zustand) for state
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) for auth
- [Axios](https://axios-http.com/) for API calls

## Local Development

### Prerequisites
- Python 3.11+
- Node 18+
- A Supabase project and an Anthropic API key

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your values
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. The health check is `GET /` → `{"status": "alive", "game": "Alter"}`.

Apply the database schema by running `backend/schema.sql` in the Supabase SQL editor (it is idempotent — safe to re-run).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # then fill in your values
npm run dev
```

The app runs at `http://localhost:5173` and proxies `/api` and `/ws` to the backend.

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon (or service) key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `FRONTEND_URL` | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `SECRET_KEY` | App secret, minimum 32 chars |
| `TICK_INTERVAL_SECONDS` | Simulation tick interval (default `30`) |
| `ENVIRONMENT` | `development` or `production` |

### Frontend (`frontend/.env`)
| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend base URL (e.g. `http://localhost:8000`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

## Deployment

### Backend → Railway
1. Create a new Railway project from the `backend` directory.
2. Railway uses `railway.toml` (Nixpacks builder, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check at `/`).
3. Add all backend environment variables in the Railway dashboard.
4. Set `FRONTEND_URL` to your deployed Vercel URL and `ENVIRONMENT=production`.

### Frontend → Vercel
1. Import the `frontend` directory as a Vercel project (framework preset: Vite).
2. `vercel.json` rewrites all routes to `index.html` for client-side routing.
3. Add the `VITE_*` environment variables in the Vercel dashboard.
4. Set `VITE_API_URL` to your deployed Railway backend URL.

---

Built solo. Watch yourself live.
