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

## Start only the iOS backend

Run this in the project root before launching the iOS simulator:

```bash
./scripts/ios-dev.sh
```

The script checks `http://localhost:3000/api/health` first. If the backend is
already running, it exits without starting another copy. If it is not running,
it starts the backend in the background and writes logs to
`$TMPDIR/portfolio-tracker-ios-dev.log`.

## Required local config

- Create `server/.env` from [server/.env.example](/Users/hermes/Desktop/portfolio-tracker/server/.env.example)
- Create `client/.env.local` from [client/.env.example](/Users/hermes/Desktop/portfolio-tracker/client/.env.example)
- Set `VITE_GOOGLE_CLIENT_ID` explicitly for the frontend
- Set `GOOGLE_CLIENT_ID` to the Web OAuth client ID used by the backend.
- Set the iOS app's `GIDServerClientID` to that same Web OAuth client ID. Keep
  `GIDClientID` set to the separate iOS OAuth client ID registered for the app's
  bundle identifier.

## How to tell what is broken

- If `http://localhost:5173` does not open, the Vite frontend did not start.
- If `http://localhost:3000/api/health` does not open, the backend did not start.
- If `/api/health` opens but shows `"database":{"ok":false}`, the backend is up but PostgreSQL is not reachable.
- If `/api/health` shows `"googleAuthConfigured": false`, Google login is not fully configured yet.

## Stop everything

Press `Ctrl+C` in the terminal where `npm run dev` is running.
