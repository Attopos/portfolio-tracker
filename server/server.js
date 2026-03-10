const express = require("express");
const cors = require("cors");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();
const positionsRouter = require("./routes/positions");

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

    const user = {
      sub: payload.sub,
      email: payload.email || "",
      name: payload.name || "",
      picture: payload.picture || "",
    };

    console.log("Google token verified:", user);
    return res.json({ ok: true, user });
  } catch (error) {
    console.error("Google token verification failed:", error);
    return res.status(401).json({ ok: false, error: "Invalid Google token." });
  }
});

app.use("/api/positions", positionsRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
