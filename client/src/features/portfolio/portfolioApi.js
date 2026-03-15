import { apiFetch } from "../../lib/api.js";

const FX_RATE_API_URL = "https://api.frankfurter.app/latest?from=USD&to=CNY";
const STANDARD_MARKET_ASSETS = {
  BTC: {
    symbol: "BTC",
    aliases: ["BTC", "BITCOIN"],
  },
  ETH: {
    symbol: "ETH",
    aliases: ["ETH", "ETHEREUM"],
  },
};

const STANDARD_MARKET_ALIAS_LOOKUP = buildStandardMarketAliasLookup();

function buildStandardMarketAliasLookup() {
  const map = Object.create(null);
  const symbols = Object.keys(STANDARD_MARKET_ASSETS);

  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index];
    const asset = STANDARD_MARKET_ASSETS[symbol];

    for (let aliasIndex = 0; aliasIndex < asset.aliases.length; aliasIndex += 1) {
      map[asset.aliases[aliasIndex]] = symbol;
    }

    map[symbol] = symbol;
  }

  return map;
}

function normalizeResponseError(payload, fallbackMessage) {
  return payload && typeof payload.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : fallbackMessage;
}

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

export function normalizeMarketAssetSymbol(value) {
  const key = String(value || "").trim().toUpperCase();
  return STANDARD_MARKET_ALIAS_LOOKUP[key] || "";
}

export function detectStandardMarketSymbol(assetId, assetName) {
  return normalizeMarketAssetSymbol(assetId) || normalizeMarketAssetSymbol(assetName);
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

  return {
    id,
    name,
    currency,
    position: Number.isFinite(position) ? position : 0,
    price: Number.isFinite(price) ? price : 0,
    standardSymbol: detectStandardMarketSymbol(id, name),
  };
}

export async function fetchPositions() {
  const response = await apiFetch("/api/positions");
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch positions."));
  }

  return Array.isArray(payload) ? payload.map(normalizePosition).filter(Boolean) : [];
}

export async function fetchTransactions() {
  const response = await apiFetch("/api/transactions");
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch transactions."));
  }

  return Array.isArray(payload?.transactions) ? payload.transactions : [];
}

export async function fetchPortfolioHistory(range = "30d") {
  const response = await apiFetch("/api/portfolio-history?range=" + encodeURIComponent(range));
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch portfolio history."));
  }

  return Array.isArray(payload?.points) ? payload.points : [];
}

export async function createHoldingTransaction(payload) {
  const response = await apiFetch("/api/transactions", {
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
  const response = await apiFetch("/api/transactions", {
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

export async function fetchUsdCnyRate() {
  const response = await fetch(FX_RATE_API_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("FX API HTTP " + response.status);
  }

  const payload = await response.json();
  const rate = Number(payload?.rates?.CNY);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("FX API invalid rate payload");
  }

  return rate;
}

export async function fetchMarketPrices(symbols) {
  const safeSymbols = Array.isArray(symbols)
    ? symbols.map((symbol) => normalizeMarketAssetSymbol(symbol)).filter(Boolean)
    : [];

  if (safeSymbols.length === 0) {
    return {};
  }

  const response = await apiFetch(
    "/api/market-prices?assets=" + encodeURIComponent(Array.from(new Set(safeSymbols)).join(","))
  );
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(normalizeResponseError(payload, "Failed to fetch market prices."));
  }

  return payload?.prices && typeof payload.prices === "object" ? payload.prices : {};
}
