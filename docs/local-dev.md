# Local Development

## Start everything

Run this in the project root:

```bash
npm run dev
```

This starts:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## How to tell what is broken

- If `http://localhost:5173` does not open, the Vite frontend did not start.
- If `http://localhost:3000/api/health` does not open, the backend did not start.
- If `/api/health` opens but shows `"database":{"ok":false}`, the backend is up but PostgreSQL is not reachable.
- If `/api/health` shows `"googleAuthConfigured": false`, Google login is not fully configured yet.

## Stop everything

Press `Ctrl+C` in the terminal where `npm run dev` is running.
