import { APP_ENV } from "../config/env.js";

function deriveApiBaseUrl() {
  const override = String(window.__API_BASE_URL || "").trim();
  if (override) {
    return override.replace(/\/+$/, "");
  }

  if (APP_ENV.apiBaseUrl) {
    return APP_ENV.apiBaseUrl.replace(/\/+$/, "");
  }

  if (window.location.protocol === "file:") {
    return "http://localhost:3000";
  }

  return "";
}

export function getApiUrl(path) {
  const baseUrl = deriveApiBaseUrl();
  const normalizedPath = String(path || "").startsWith("/") ? path : "/" + String(path || "");
  return baseUrl + normalizedPath;
}

export async function apiFetch(path, options) {
  return fetch(getApiUrl(path), {
    credentials: "include",
    ...(options || {}),
  });
}
