const express = require("express");
const cors = require("cors");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
require("dotenv").config();
const config = require("./config");
const createAuthRouter = require("./routes/auth");
const positionsRouter = require("./routes/positions");
const fxRateRouter = require("./routes/fx-rate");
const portfolioHistoryRouter = require("./routes/portfolio-history").router;
const transactionsRouter = require("./routes/transactions");
const marketPricesRouter = require("./routes/market-prices");
const pool = require("./db");

const app = express();
const isProduction = String(process.env.NODE_ENV || "").trim() === "production";
const { allowedOrigins, backendUrl, defaultLocalSessionSecret, frontendUrl, googleClientId, port, sessionSecret, sessionTtlDays } = config;
const PgSession = connectPgSimple(session);
const sessionCookieMaxAgeMs = Math.max(sessionTtlDays, 1) * 24 * 60 * 60 * 1000;
const allowedOriginsSet = new Set(allowedOrigins);

if (!sessionSecret && isProduction) {
  throw new Error("SESSION_SECRET is required when NODE_ENV=production.");
}

app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOriginsSet.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    name: "portfolio.sid",
    secret: sessionSecret || defaultLocalSessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: sessionCookieMaxAgeMs,
    },
  })
);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/api/health", async (req, res) => {
  let databaseOk = false;
  let databaseError = "";

  try {
    await pool.query("SELECT 1");
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database connection failed.";
  }

  const payload = {
    ok: databaseOk,
    service: "portfolio-tracker-server",
    frontendUrl,
    backendUrl,
    database: {
      ok: databaseOk,
      error: databaseOk ? "" : databaseError,
    },
    googleAuthConfigured: Boolean(googleClientId),
  };

  if (!databaseOk) {
    return res.status(503).json(payload);
  }

  return res.json(payload);
});

app.use(createAuthRouter({ isProduction }));
app.use("/api/positions", positionsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/fx-rate", fxRateRouter);
app.use("/api/market-prices", marketPricesRouter);
app.use("/api/portfolio-history", portfolioHistoryRouter);

app.listen(port, () => {
  console.log(`Server running at ${backendUrl}`);
});
