const express = require("express");
const cors = require("cors");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();
const positionsRouter = require("./routes/positions");
const pool = require("./db");

const app = express();
const port = Number(process.env.PORT) || 3000;
const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const googleClient = new OAuth2Client(googleClientId);
const allowedOrigins = new Set(["http://127.0.0.1:5500", "http://localhost:5500"]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

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

app.use("/api/positions", positionsRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
