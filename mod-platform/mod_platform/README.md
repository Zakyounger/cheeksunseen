# Mod Developer Platform

Minimal developer-controlled mod platform foundation.

- Frontend management dashboard
- REST API
- SQLite database
- Session-based admin authentication
- Mods, tutorials, links, contributors
- Token table/API foundation
- Modular API router for future services

## Run

1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD` and `SESSION_SECRET`.
4. `npm run dev`
5. Open `http://localhost:8787`

The frontend is served by the backend. The API is under `/api/v1`.
