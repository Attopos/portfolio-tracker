const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/require-auth");
const { detectMarketSymbol, fetchCoinGeckoPrices } = require("../services/market-prices");

const router = express.Router();

const DEFAULT_CNY_PER_USD = 6.91;
const FX_RATE_CACHE_MS = 15 * 60 * 1000;
const RANGE_TO_MS = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

let cachedUsdCnyRate = DEFAULT_CNY_PER_USD;
let cachedUsdCnyRateAt = 0;

function getCurrentHourBucketStart() {
  const bucketStart = new Date();
  bucketStart.setUTCMinutes(0, 0, 0);
  return bucketStart;
}

function getNextHourBucketStart(bucketStart) {
  return new Date(bucketStart.getTime() + 60 * 60 * 1000);
}

async function fetchUsdCnyRate() {
  const now = Date.now();
  if (now - cachedUsdCnyRateAt < FX_RATE_CACHE_MS) {
    return cachedUsdCnyRate;
  }

  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=CNY", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Frankfurter HTTP " + response.status);
    }

    const payload = await response.json();
    const rate = Number(payload && payload.rates && payload.rates.CNY);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid USD/CNY rate payload");
    }

    cachedUsdCnyRate = rate;
    cachedUsdCnyRateAt = now;
    return rate;
  } catch (error) {
    console.error("Failed to refresh backend FX rate, using cached/default rate:", error);
    return cachedUsdCnyRate;
  }
}

async function buildFxRateResponse() {
  const usdCnyRate = await fetchUsdCnyRate();
  return {
    base: "USD",
    quote: "CNY",
    rate: usdCnyRate,
    source: "frankfurter",
    fetchedAt: new Date().toISOString(),
  };
}

async function calculatePortfolioSnapshot(userId) {
  const usdCnyRate = await fetchUsdCnyRate();
  const result = await pool.query(
    "SELECT id, name, currency, position, price FROM positions WHERE user_id = $1 ORDER BY id",
    [userId]
  );

  const positions = Array.isArray(result.rows) ? result.rows : [];
  if (positions.length === 0) {
    return null;
  }

  const marketSymbols = Array.from(
    new Set(
      positions
        .map((row) => detectMarketSymbol(row.id, row.name))
        .filter(Boolean)
    )
  );
  let marketPricesBySymbol = {};

  if (marketSymbols.length > 0) {
    try {
      marketPricesBySymbol = await fetchCoinGeckoPrices(marketSymbols);
    } catch (error) {
      console.error("Failed to load CoinGecko prices for snapshot, using stored prices:", error);
    }
  }

  let totalUsd = 0;
  for (let i = 0; i < positions.length; i++) {
    const row = positions[i];
    const symbol = detectMarketSymbol(row.id, row.name);
    const marketPrice = symbol ? marketPricesBySymbol[symbol] : null;
    const currency = String(row.currency || "").trim().toUpperCase() === "CNY" ? "CNY" : "USD";
    const position = Number(row.position);
    const fallbackPrice = Number(row.price);
    const effectivePrice =
      marketPrice && typeof marketPrice === "object"
        ? currency === "CNY"
          ? Number(marketPrice.cny)
          : Number(marketPrice.usd)
        : fallbackPrice;

    if (!Number.isFinite(position) || !Number.isFinite(effectivePrice)) {
      continue;
    }

    if (currency === "CNY") {
      totalUsd += (position * effectivePrice) / usdCnyRate;
    } else {
      totalUsd += position * effectivePrice;
    }
  }

  return {
    totalUsd,
  };
}

async function recordPortfolioSnapshotForUser(userId) {
  const snapshot = await calculatePortfolioSnapshot(userId);
  if (!snapshot) {
    return false;
  }

  const bucketStart = getCurrentHourBucketStart();
  const nextBucketStart = getNextHourBucketStart(bucketStart);
  const existing = await pool.query(
    `
      SELECT id
      FROM portfolio_value_snapshots
      WHERE user_id = $1
        AND captured_at >= $2
        AND captured_at < $3
      LIMIT 1
    `,
    [userId, bucketStart.toISOString(), nextBucketStart.toISOString()]
  );

  if (existing.rowCount > 0) {
    await pool.query(
      "UPDATE portfolio_value_snapshots SET total_usd = $1 WHERE id = $2",
      [snapshot.totalUsd, existing.rows[0].id]
    );
    return true;
  }

  await pool.query(
    `
      INSERT INTO portfolio_value_snapshots (user_id, total_usd, captured_at)
      VALUES ($1, $2, $3)
    `,
    [userId, snapshot.totalUsd, bucketStart.toISOString()]
  );
  return true;
}

router.get("/", requireAuth, async (req, res) => {
  const requestedRange = String(req.query.range || "30d").trim().toLowerCase();
  const rangeMs = RANGE_TO_MS[requestedRange];

  if (!rangeMs) {
    return res.status(400).json({ error: "Invalid range" });
  }

  try {
    await recordPortfolioSnapshotForUser(req.userId);

    const since = new Date(Date.now() - rangeMs);
    const result = await pool.query(
      `
        SELECT total_usd, captured_at
        FROM portfolio_value_snapshots
        WHERE user_id = $1
          AND captured_at >= $2
        ORDER BY captured_at ASC
      `,
      [req.userId, since.toISOString()]
    );

    return res.json({
      ok: true,
      range: requestedRange,
      points: result.rows.map((row) => ({
        totalUsd: Number(row.total_usd),
        capturedAt: row.captured_at,
      })),
    });
  } catch (error) {
    console.error("Failed to read portfolio history:", error);
    return res.status(500).json({ error: "Failed to read portfolio history" });
  }
});

module.exports = {
  buildFxRateResponse,
  fetchUsdCnyRate,
  router,
  recordPortfolioSnapshotForUser,
};
