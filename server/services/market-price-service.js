const COINGECKO_SIMPLE_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
const TWELVE_DATA_PRICE_URL = "https://api.twelvedata.com/price";
const assetRegistryData = require("../../client/src/features/assets/assetRegistryData.json");
const PRICE_CACHE_MS = 60 * 1000;
const FX_RATE_CACHE_MS = 15 * 60 * 1000;
const COINGECKO_DEMO_API_KEY = String(process.env.COINGECKO_DEMO_API_KEY || "").trim();
const TWELVE_DATA_API_KEY = String(process.env.TWELVE_DATA_API_KEY || "").trim();

const SUPPORTED_MARKET_ASSETS = assetRegistryData.reduce((assets, asset) => {
  if (!asset || typeof asset !== "object" || !asset.marketData || !asset.symbol) {
    return assets;
  }

  assets[asset.symbol] = {
    symbol: asset.symbol,
    aliases: Array.isArray(asset.aliases) ? asset.aliases : [],
    ...asset.marketData,
  };

  return assets;
}, {});

const aliasToSymbol = buildAliasToSymbol();
let cachedPricesBySymbol = {};
let cachedPricesAt = 0;
const cachedFxRates = new Map();

function buildAliasToSymbol() {
  const map = new Map();
  const symbols = Object.keys(SUPPORTED_MARKET_ASSETS);
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    const asset = SUPPORTED_MARKET_ASSETS[symbol];
    for (let j = 0; j < asset.aliases.length; j += 1) {
      map.set(asset.aliases[j], symbol);
    }
    map.set(symbol, symbol);
  }
  return map;
}

function normalizeMarketAssetSymbol(value) {
  const key = String(value || "")
    .trim()
    .toUpperCase();
  return aliasToSymbol.get(key) || "";
}

function detectAssetSymbol(assetId, assetName) {
  return normalizeMarketAssetSymbol(assetId) || normalizeMarketAssetSymbol(assetName);
}

function pickNumericValue(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = ["adjusted_close", "close", "price", "previousClose"];
  for (let index = 0; index < candidates.length; index += 1) {
    const value = Number(payload[candidates[index]]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

async function fetchFxRate(baseCurrency, quoteCurrency) {
  const base = String(baseCurrency || "").trim().toUpperCase();
  const quote = String(quoteCurrency || "").trim().toUpperCase();

  if (!base || !quote || base === quote) {
    return 1;
  }

  const cacheKey = `${base}/${quote}`;
  const now = Date.now();
  const cached = cachedFxRates.get(cacheKey);
  if (cached && now - cached.at < FX_RATE_CACHE_MS) {
    return cached.rate;
  }

  const response = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Frankfurter HTTP ${response.status} for ${cacheKey}`);
  }

  const payload = await response.json();
  const rate = Number(payload && payload.rates && payload.rates[quote]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX payload for ${cacheKey}`);
  }

  cachedFxRates.set(cacheKey, {
    at: now,
    rate,
  });

  return rate;
}

async function fetchCoinGeckoPrices(symbols) {
  const uniqueSymbols = Array.from(new Set(symbols)).filter(
    (symbol) => SUPPORTED_MARKET_ASSETS[symbol] && SUPPORTED_MARKET_ASSETS[symbol].provider === "coingecko"
  );
  if (uniqueSymbols.length === 0) {
    return {};
  }

  const ids = uniqueSymbols.map((symbol) => SUPPORTED_MARKET_ASSETS[symbol].coingeckoId).join(",");
  const requestUrl =
    COINGECKO_SIMPLE_PRICE_URL +
    "?ids=" +
    encodeURIComponent(ids) +
    "&vs_currencies=usd,cny&include_last_updated_at=true&include_24hr_change=true&precision=full";
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
  const result = {};

  for (let i = 0; i < uniqueSymbols.length; i += 1) {
    const symbol = uniqueSymbols[i];
    const asset = SUPPORTED_MARKET_ASSETS[symbol];
    const row = payload && payload[asset.coingeckoId];
    const usd = Number(row && row.usd);
    const cny = Number(row && row.cny);
    const usd24hChange = Number(row && row.usd_24h_change);
    const cny24hChange = Number(row && row.cny_24h_change);
    const lastUpdatedAt = Number(row && row.last_updated_at);

    if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(cny) || cny <= 0) {
      continue;
    }

    result[symbol] = {
      symbol,
      usd,
      cny,
      usd24hChange: Number.isFinite(usd24hChange) ? usd24hChange : null,
      cny24hChange: Number.isFinite(cny24hChange) ? cny24hChange : null,
      lastUpdatedAt:
        Number.isFinite(lastUpdatedAt) && lastUpdatedAt > 0
          ? new Date(lastUpdatedAt * 1000).toISOString()
          : new Date().toISOString(),
      source: "coingecko",
    };
  }

  return result;
}

async function fetchTwelveDataPrices(symbols) {
  const uniqueSymbols = Array.from(new Set(symbols)).filter(
    (symbol) => SUPPORTED_MARKET_ASSETS[symbol] && SUPPORTED_MARKET_ASSETS[symbol].provider === "twelvedata"
  );
  if (uniqueSymbols.length === 0) {
    return {};
  }

  if (!TWELVE_DATA_API_KEY) {
    return {};
  }

  const result = {};
  for (let index = 0; index < uniqueSymbols.length; index += 1) {
    const symbol = uniqueSymbols[index];
    const asset = SUPPORTED_MARKET_ASSETS[symbol];
    const requestUrl =
      `${TWELVE_DATA_PRICE_URL}?symbol=${encodeURIComponent(asset.providerSymbol)}` +
      `${asset.exchange ? `&exchange=${encodeURIComponent(asset.exchange)}` : ""}` +
      `&apikey=${encodeURIComponent(TWELVE_DATA_API_KEY)}`;
    try {
      const response = await fetch(requestUrl, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Twelve Data HTTP ${response.status} for ${asset.providerSymbol}`);
      }

      const payload = await response.json();
      if (payload && payload.status === "error") {
        throw new Error(`Twelve Data error for ${asset.providerSymbol}: ${payload.message || "unknown error"}`);
      }

      const nativePrice = pickNumericValue(payload) || Number(payload && payload.price);
      if (!Number.isFinite(nativePrice) || nativePrice <= 0) {
        continue;
      }

      const usdRate = await fetchFxRate(asset.quoteCurrency, "USD");
      const cnyRate = await fetchFxRate(asset.quoteCurrency, "CNY");
      result[symbol] = {
        symbol,
        usd: nativePrice * usdRate,
        cny: nativePrice * cnyRate,
        nativeCurrency: asset.quoteCurrency,
        nativePrice,
        usd24hChange: null,
        cny24hChange: null,
        lastUpdatedAt: new Date().toISOString(),
        source: "twelvedata",
      };
    } catch (error) {
      console.error(`Failed to load Twelve Data price for ${symbol}:`, error.message || error);
    }
  }

  return result;
}

async function fetchMarketPrices(symbols) {
  const uniqueSymbols = Array.from(new Set(symbols)).filter((symbol) => SUPPORTED_MARKET_ASSETS[symbol]);
  if (uniqueSymbols.length === 0) {
    return {};
  }

  const now = Date.now();
  if (now - cachedPricesAt < PRICE_CACHE_MS) {
    const cachedSubset = {};
    for (let i = 0; i < uniqueSymbols.length; i += 1) {
      const symbol = uniqueSymbols[i];
      if (cachedPricesBySymbol[symbol]) {
        cachedSubset[symbol] = cachedPricesBySymbol[symbol];
      }
    }
    if (Object.keys(cachedSubset).length === uniqueSymbols.length) {
      return cachedSubset;
    }
  }

  const [coingeckoPrices, twelveDataPrices] = await Promise.all([
    fetchCoinGeckoPrices(uniqueSymbols),
    fetchTwelveDataPrices(uniqueSymbols),
  ]);

  cachedPricesBySymbol = {
    ...cachedPricesBySymbol,
    ...coingeckoPrices,
    ...twelveDataPrices,
  };
  cachedPricesAt = now;

  const result = {};
  for (let i = 0; i < uniqueSymbols.length; i += 1) {
    const symbol = uniqueSymbols[i];
    if (cachedPricesBySymbol[symbol]) {
      result[symbol] = cachedPricesBySymbol[symbol];
    }
  }

  return result;
}

module.exports = {
  detectAssetSymbol,
  fetchMarketPrices,
  normalizeMarketAssetSymbol,
};
