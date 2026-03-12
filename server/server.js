const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();
const positionsRouter = require("./routes/positions");
const portfolioHistoryRouter = require("./routes/portfolio-history").router;
const transactionsRouter = require("./routes/transactions");
const pool = require("./db");

const app = express();
const isProduction = String(process.env.NODE_ENV || "").trim() === "production";
const port = Number(process.env.PORT) || 3000;
const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
const googleClient = new OAuth2Client(googleClientId);
const allowedOrigins = new Set(
  String(
    process.env.APP_ORIGINS ||
      "http://127.0.0.1:5500,http://localhost:5500,http://23.95.67.158:3001"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (!sessionSecret && isProduction) {
  throw new Error("SESSION_SECRET is required when NODE_ENV=production.");
}

app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
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
    secret: sessionSecret || "local-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  })
);

app.get("/", (req, res) => {
  res.send("Server is running");
});

async function findLocalUserById(userId) {
  const result = await pool.query(
    "SELECT id, google_sub, email, name, avatar_url, created_at, updated_at FROM users WHERE id = $1",
    [userId]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function findOrCreateLocalUser(googleProfile) {
  const selectSql = "SELECT * FROM users WHERE google_sub = $1";
  const selectParams = [googleProfile.sub];
  const existingResult = await pool.query(selectSql, selectParams);

  if (existingResult.rowCount > 0) {
    return existingResult.rows[0];
  }

  const insertSql = `
    INSERT INTO users (google_sub, email, name, avatar_url)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const insertParams = [
    googleProfile.sub,
    googleProfile.email,
    googleProfile.name,
    googleProfile.picture,
  ];
  const insertResult = await pool.query(insertSql, insertParams);
  return insertResult.rows[0];
}

app.post("/auth/google", async (req, res) => {
  const credential = String(req.body && req.body.credential ? req.body.credential : "").trim();
  if (!credential) {
    return res.status(400).json({ ok: false, error: "Missing credential." });
  }

  if (!googleClientId) {
    console.error("Google auth misconfigured: GOOGLE_CLIENT_ID is missing.");
    return res.status(500).json({ ok: false, error: "Google auth is not configured." });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub) {
      return res.status(401).json({ ok: false, error: "Invalid Google token." });
    }

    const googleUser = {
      sub: payload.sub,
      email: payload.email || "",
      name: payload.name || "",
      picture: payload.picture || "",
    };
    const localUser = await findOrCreateLocalUser(googleUser);
    req.session.userId = Number(localUser.id);

    console.log("Google token verified for local user:", {
      id: localUser.id,
      google_sub: localUser.google_sub,
      email: localUser.email,
    });
    return res.json({ ok: true, user: localUser });
  } catch (error) {
    if (error && (error.message || "").toLowerCase().includes("token")) {
      console.error("Google token verification failed:", error.message);
      return res.status(401).json({ ok: false, error: "Invalid Google token." });
    }

    console.error("Google auth database error:", error);
    return res.status(500).json({ ok: false, error: "Failed to find or create local user." });
  }
});

app.get("/api/me", async (req, res) => {
  const userId = Number(req.session && req.session.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ ok: false, error: "Unauthenticated." });
  }

  try {
    const user = await findLocalUserById(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ ok: false, error: "Unauthenticated." });
    }

    return res.json({ ok: true, user });
  } catch (error) {
    console.error("Failed to read current session user:", error);
    return res.status(500).json({ ok: false, error: "Failed to load current user." });
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Failed to destroy session:", error);
      return res.status(500).json({ ok: false, error: "Failed to log out." });
    }

    res.clearCookie("portfolio.sid");
    return res.json({ ok: true });
  });
});

app.use("/api/positions", positionsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/portfolio-history", portfolioHistoryRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
