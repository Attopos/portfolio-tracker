import { apiFetch } from "../../lib/api.js";
import { API_ROUTES } from "../../lib/endpoints.js";
import { normalizeResponseError, readJsonSafely } from "../../lib/http.js";
import { findPresetAsset } from "../assets/assetDatabase.js";

function normalizeAssetSymbol(value) {
  return findPresetAsset(value)?.symbol || "";
}

function detectAssetSymbol(assetId, assetName) {
  return normalizeAssetSymbol(assetId) || normalizeAssetSymbol(assetName);
}

function normalizePosition(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) {
    return null;
  }

  const currency = row.currency === "CNY" ? "CNY" : "USD";
  const position = Number(row.position);
  const price = Number(row.price);
  const manualMarketPrice = row.manual_market_price === null ? null : Number(row.manual_market_price);

  return {
    id,
    name,
    currency,
    position: Number.isFinite(position) ? position : 0,
    price: Number.isFinite(price) ? price : 0,
    manualMarketPrice:
      manualMarketPrice === null
        ? null
        : Number.isFinite(manualMarketPrice)
        ? manualMarketPrice
        : null,
    assetSymbol: detectAssetSymbol(id, name),
  };
}

export async function fetchPositions() {
  const response = await apiFetch(API_ROUTES.positions.list);
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch positions."));
  }

  return Array.isArray(payload?.positions) ? payload.positions.map(normalizePosition).filter(Boolean) : [];
}

export async function fetchTransactions() {
  const response = await apiFetch(API_ROUTES.transactions.list);
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch transactions."));
  }

  return Array.isArray(payload?.transactions) ? payload.transactions : [];
}

export async function createHoldingTransaction(payload) {
  const response = await apiFetch(API_ROUTES.transactions.create, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await readJsonSafely(response);

  if (!response.ok || !body?.ok) {
    throw new Error(normalizeResponseError(body, "Failed to create holding."));
  }

  return body.transaction || null;
}

export async function createTradeTransaction(payload) {
  const response = await apiFetch(API_ROUTES.transactions.create, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await readJsonSafely(response);

  if (!response.ok || !body?.ok) {
    throw new Error(normalizeResponseError(body, "Failed to record transaction."));
  }

  return body.transaction || null;
}

export async function deleteHolding(assetId) {
  const response = await apiFetch(API_ROUTES.positions.delete(assetId), {
    method: "DELETE",
  });
  const body = await readJsonSafely(response);

  if (!response.ok || !body?.ok) {
    throw new Error(normalizeResponseError(body, "Failed to delete holding."));
  }
}

export async function updateHolding(assetId, payload) {
  const response = await apiFetch(API_ROUTES.positions.update(assetId), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await readJsonSafely(response);

  if (!response.ok || !body?.ok) {
    throw new Error(normalizeResponseError(body, "Failed to update holding."));
  }

  return normalizePosition(body.position);
}

export async function deleteTransaction(transactionId) {
  const response = await apiFetch(API_ROUTES.transactions.delete(transactionId), {
    method: "DELETE",
  });
  const body = await readJsonSafely(response);

  if (!response.ok || !body?.ok) {
    throw new Error(normalizeResponseError(body, "Failed to delete transaction."));
  }
}

export async function fetchUsdCnyRate() {
  const response = await apiFetch(API_ROUTES.fxRate.current);
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch FX rate."));
  }

  const rate = Number(payload?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("FX API invalid rate payload");
  }

  return rate;
}

export async function fetchMarketPrices(symbols) {
  const safeSymbols = Array.isArray(symbols)
    ? symbols.map((symbol) => normalizeAssetSymbol(symbol)).filter(Boolean)
    : [];

  if (safeSymbols.length === 0) {
    return {};
  }

  const response = await apiFetch(
    API_ROUTES.marketPrices.list +
      "?assets=" +
      encodeURIComponent(Array.from(new Set(safeSymbols)).join(","))
  );
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch market prices."));
  }

  return payload?.prices && typeof payload.prices === "object" ? payload.prices : {};
}

export async function fetchPortfolioDailySummary() {
  const response = await apiFetch(API_ROUTES.portfolioHistory.summary);
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch portfolio daily summary."));
  }

  return payload?.summary && typeof payload.summary === "object" ? payload.summary : null;
}
