import { apiFetch } from "../../lib/api.js";
import { API_ROUTES } from "../../lib/endpoints.js";
import { normalizeResponseError, readJsonSafely } from "../../lib/http.js";

export async function fetchCurrentUser() {
  const response = await apiFetch(API_ROUTES.auth.me);

  if (response.status === 401) {
    return null;
  }

  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to restore session."));
  }

  const user = payload && payload.user ? payload.user : null;
  const userId = Number(user && user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Session response missing a valid local user id.");
  }

  return user;
}

export async function signInWithGoogleCredential(credential) {
  const response = await apiFetch(API_ROUTES.auth.googleSignIn, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const payload = await readJsonSafely(response);
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(normalizeResponseError(payload, "Google sign-in failed."));
  }

  return payload.user || null;
}

export async function signOutFromSession() {
  const response = await apiFetch(API_ROUTES.auth.logout, {
    method: "POST",
  });

  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to sign out."));
  }
}
