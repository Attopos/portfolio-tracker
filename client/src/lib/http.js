export async function readJsonSafely(response) {
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

export function normalizeResponseError(payload, fallbackMessage) {
  return payload && typeof payload.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : fallbackMessage;
}
