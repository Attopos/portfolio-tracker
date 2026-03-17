const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";

export const APP_ENV = {
  apiBaseUrl: API_BASE_URL,
  googleClientId: GOOGLE_CLIENT_ID,
  googleGsiSrc: GOOGLE_GSI_SRC,
};

export function isGoogleAuthConfigured() {
  return Boolean(APP_ENV.googleClientId);
}
