# API Endpoints

This document reflects the active API surface used by the current client.

## Active endpoints

### Authentication

- `POST /api/auth/google`
  - File: `server/server.js`
  - Purpose: Accepts a Google ID token, verifies it, creates or loads the local user, and stores the logged-in user id in the session.

- `POST /api/auth/logout`
  - File: `server/server.js`
  - Purpose: Destroys the current session and clears the session cookie.

- `GET /api/me`
  - File: `server/server.js`
  - Purpose: Reads the current session and returns the signed-in local user.

### Portfolio data

- `GET /api/positions`
  - File: `server/routes/positions.js`
  - Purpose: Returns the authenticated user's current holdings and records a portfolio snapshot opportunistically.

- `GET /api/transactions`
  - File: `server/routes/transactions.js`
  - Purpose: Returns the authenticated user's most recent transactions.

- `POST /api/transactions`
  - File: `server/routes/transactions.js`
  - Purpose: Creates a buy, sell, or set transaction and updates the corresponding holding in `positions`.

- `GET /api/portfolio-history`
  - File: `server/routes/portfolio-history.js`
  - Purpose: Returns historical portfolio value points for the requested range and ensures a current snapshot exists.

### Market data

- `GET /api/fx-rate`
  - File: `server/routes/fx-rate.js`
  - Purpose: Returns the current USD/CNY FX rate used by the app.

- `GET /api/market-prices`
  - File: `server/routes/market-prices.js`
  - Purpose: Returns current market prices for supported assets such as BTC and ETH.

## Removed endpoints

The following routes were removed from the active API surface because the current client no longer uses them and their responsibilities are covered by `POST /api/transactions`.

- `POST /api/positions`
- `PUT /api/positions/:id`
- `DELETE /api/positions/:id`

These used to mutate holdings directly, but the current app model writes holdings through transaction creation instead.
