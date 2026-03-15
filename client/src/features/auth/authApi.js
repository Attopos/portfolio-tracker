import { apiFetch } from "../../lib/api.js";

async function readJsonSafely(response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchCurrentUser() {
  const response = await apiFetch("/api/me");

  if (response.status === 401) {
    return null;
  }

  const payload = await readJsonSafely(response);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : "Failed to restore session.";
    throw new Error(message);
  }

  const user = payload && payload.user ? payload.user : null;
  const userId = Number(user && user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Session response missing a valid local user id.");
  }

  return user;
}

export async function signInWithGoogleCredential(credential) {
  const response = await apiFetch("/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const payload = await readJsonSafely(response);
  if (!response.ok || !payload || payload.ok !== true) {
    const message =
      payload && typeof payload.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : "Google sign-in failed.";
    throw new Error(message);
  }

  return payload.user || null;
}

export async function signOutFromSession() {
  const response = await apiFetch("/auth/logout", {
    method: "POST",
  });

  const payload = await readJsonSafely(response);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : "Failed to sign out.";
    throw new Error(message);
  }
}
