const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_CLIENT_PORT = 5173;
const DEFAULT_SERVER_HOST = "localhost";
const DEFAULT_FRONTEND_HOST = "localhost";
const DEFAULT_LOCAL_SESSION_SECRET = "local-dev-session-secret";

function readStringEnv(name, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

function readNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function buildFrontendUrl() {
  const explicitUrl = readStringEnv("FRONTEND_URL");
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const host = readStringEnv("FRONTEND_HOST", DEFAULT_FRONTEND_HOST);
  const port = readNumberEnv("CLIENT_PORT", DEFAULT_CLIENT_PORT);
  return `http://${host}:${port}`;
}

function buildBackendUrl(port) {
  const explicitUrl = readStringEnv("BACKEND_URL");
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const host = readStringEnv("BACKEND_HOST", DEFAULT_SERVER_HOST);
  return `http://${host}:${port}`;
}

function buildAllowedOrigins(frontendUrl) {
  const explicitOrigins = readStringEnv("APP_ORIGINS");
  if (explicitOrigins) {
    return explicitOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const derivedOrigins = new Set([frontendUrl]);

  try {
    const parsed = new URL(frontendUrl);
    if (parsed.hostname === "localhost") {
      derivedOrigins.add(`${parsed.protocol}//127.0.0.1${parsed.port ? ":" + parsed.port : ""}`);
    } else if (parsed.hostname === "127.0.0.1") {
      derivedOrigins.add(`${parsed.protocol}//localhost${parsed.port ? ":" + parsed.port : ""}`);
    }
  } catch {
    derivedOrigins.add("http://localhost:5173");
    derivedOrigins.add("http://127.0.0.1:5173");
  }

  return Array.from(derivedOrigins);
}

const port = readNumberEnv("PORT", DEFAULT_SERVER_PORT);
const frontendUrl = buildFrontendUrl();
const backendUrl = buildBackendUrl(port);

module.exports = {
  backendUrl,
  frontendUrl,
  googleClientId: readStringEnv("GOOGLE_CLIENT_ID"),
  port,
  sessionSecret: readStringEnv("SESSION_SECRET"),
  sessionTtlDays: readNumberEnv("SESSION_TTL_DAYS", 30),
  defaultLocalSessionSecret: DEFAULT_LOCAL_SESSION_SECRET,
  allowedOrigins: buildAllowedOrigins(frontendUrl),
};
