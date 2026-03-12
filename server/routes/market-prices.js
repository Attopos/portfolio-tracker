const express = require("express");

const router = express.Router();

const COINGECKO_SIMPLE_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_CACHE_MS = 60 * 1000;
const COINGECKO_DEMO_API_KEY = String(process.env.COINGECKO_DEMO_API_KEY || "").trim();
const SUPPORTED_MARKET_ASSETS = {
  BTC: {
    symbol: "BTC",
    coingeckoId: "bitcoin",
    aliases: ["BTC", "BITCOIN"],
  },
  ETH: {
    symbol: "ETH",
    coingeckoId: "ethereum",
    aliases: ["ETH", "ETHEREUM"],
  },
};

const aliasToSymbol = buildAliasToSymbol();
let cachedPricesBySymbol = {};
let cachedPricesAt = 0;

function buildAliasToSymbol() {
  const map = new Map();
  const symbols = Object.keys(SUPPORTED_MARKET_ASSETS);
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const asset = SUPPORTED_MARKET_ASSETS[symbol];
    for (let j = 0; j < asset.aliases.length; j++) {
      map.set(asset.aliases[j], symbol);
    }
    map.set(symbol, symbol);
  }
  return map;
}

function normalizeRequestedAsset(value) {
  const key = String(value || "")
    .trim()
    .toUpperCase();
  return aliasToSymbol.get(key) || "";
}

async function fetchCoinGeckoPrices(symbols) {
  const uniqueSymbols = Array.from(new Set(symbols)).filter((symbol) => SUPPORTED_MARKET_ASSETS[symbol]);
  if (uniqueSymbols.length === 0) {
    return {};
  }

  const now = Date.now();
  if (now - cachedPricesAt < COINGECKO_CACHE_MS) {
    const cachedSubset = {};
    for (let i = 0; i < uniqueSymbols.length; i++) {
      const symbol = uniqueSymbols[i];
      if (cachedPricesBySymbol[symbol]) {
        cachedSubset[symbol] = cachedPricesBySymbol[symbol];
      }
    }
    if (Object.keys(cachedSubset).length === uniqueSymbols.length) {
      return cachedSubset;
    }
  }

  const ids = uniqueSymbols.map((symbol) => SUPPORTED_MARKET_ASSETS[symbol].coingeckoId).join(",");
  const requestUrl =
    COINGECKO_SIMPLE_PRICE_URL +
    "?ids=" +
    encodeURIComponent(ids) +
    "&vs_currencies=usd,cny&include_last_updated_at=true&precision=full";
  const headers = {};
  if (COINGECKO_DEMO_API_KEY) {
    headers["x-cg-demo-api-key"] = COINGECKO_DEMO_API_KEY;
  }

  const response = await fetch(requestUrl, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("CoinGecko HTTP " + response.status);
  }

  const payload = await response.json();
  const nextPricesBySymbol = { ...cachedPricesBySymbol };

  for (let i = 0; i < uniqueSymbols.length; i++) {
    const symbol = uniqueSymbols[i];
    const asset = SUPPORTED_MARKET_ASSETS[symbol];
    const row = payload && payload[asset.coingeckoId];
    const usd = Number(row && row.usd);
    const cny = Number(row && row.cny);
    const lastUpdatedAt = Number(row && row.last_updated_at);

    if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(cny) || cny <= 0) {
      continue;
    }

    nextPricesBySymbol[symbol] = {
      symbol,
      usd,
      cny,
      lastUpdatedAt:
        Number.isFinite(lastUpdatedAt) && lastUpdatedAt > 0
          ? new Date(lastUpdatedAt * 1000).toISOString()
          : new Date(now).toISOString(),
      source: "coingecko",
    };
  }

  cachedPricesBySymbol = nextPricesBySymbol;
  cachedPricesAt = now;

  const result = {};
  for (let i = 0; i < uniqueSymbols.length; i++) {
    const symbol = uniqueSymbols[i];
    if (cachedPricesBySymbol[symbol]) {
      result[symbol] = cachedPricesBySymbol[symbol];
    }
  }
  return result;
}

router.get("/", async (req, res) => {
  const rawAssets = String(req.query.assets || "")
    .split(",")
    .map((value) => normalizeRequestedAsset(value))
    .filter(Boolean);
  const requestedAssets = Array.from(new Set(rawAssets));

  if (requestedAssets.length === 0) {
    return res.json({ ok: true, prices: {}, fetchedAt: new Date().toISOString() });
  }

  try {
    const prices = await fetchCoinGeckoPrices(requestedAssets);
    return res.json({
      ok: true,
      prices,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load market prices from CoinGecko:", error);
    return res.status(502).json({ error: "Failed to load market prices" });
  }
});

module.exports = router;
