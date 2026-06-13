const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const config = require("../config");
const {
  findOrCreateUserFromGoogle,
  findUserById,
} = require("../services/user-service");

const googleClient = new OAuth2Client(config.googleClientId);

function saveSession(session) {
  return new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createAuthRouter({ isProduction }) {
  const router = express.Router();

  router.post("/api/auth/google", async (req, res) => {
    const credential = String(req.body && req.body.credential ? req.body.credential : "").trim();
    if (!credential) {
      return res.status(400).json({ ok: false, error: "Missing credential." });
    }

    if (!config.googleClientId) {
      console.error("Google auth misconfigured: GOOGLE_CLIENT_ID is missing.");
      return res.status(500).json({ ok: false, error: "Google auth is not configured." });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleAudiences,
      });
      payload = ticket.getPayload();

      if (!payload || !payload.sub) {
        return res.status(401).json({ ok: false, error: "Invalid Google token." });
      }
    } catch (error) {
      console.error("Google token verification failed:", error instanceof Error ? error.message : error);
      return res.status(401).json({ ok: false, error: "Invalid Google token." });
    }

    try {
      const localUser = await findOrCreateUserFromGoogle({
        sub: payload.sub,
        email: payload.email || "",
        name: payload.name || "",
        picture: payload.picture || "",
      });
      req.session.userId = Number(localUser.id);
      await saveSession(req.session);

      return res.json({ ok: true, user: localUser });
    } catch (error) {
      console.error("Google auth session error:", error);
      return res.status(500).json({ ok: false, error: "Failed to create login session." });
    }
  });

  router.get("/api/me", async (req, res) => {
    const userId = Number(req.session && req.session.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ ok: false, error: "Unauthenticated." });
    }

    try {
      const user = await findUserById(userId);
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

  router.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        console.error("Failed to destroy session:", error);
        return res.status(500).json({ ok: false, error: "Failed to log out." });
      }

      res.clearCookie("portfolio.sid", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
      });
      return res.json({ ok: true });
    });
  });

  return router;
}

module.exports = createAuthRouter;
