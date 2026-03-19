const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/require-auth");
const { detectAssetSymbol, fetchMarketPrices } = require("../services/market-price-service");

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

function getTwentyFourHoursAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
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
        .map((row) => detectAssetSymbol(row.id, row.name))
        .filter(Boolean)
    )
  );
  let marketPricesByAssetSymbol = {};

  if (marketSymbols.length > 0) {
    try {
      marketPricesByAssetSymbol = await fetchMarketPrices(marketSymbols);
    } catch (error) {
      console.error("Failed to load market prices for snapshot, using stored prices:", error);
    }
  }

  let totalUsd = 0;
  for (let i = 0; i < positions.length; i++) {
    const row = positions[i];
    const assetSymbol = detectAssetSymbol(row.id, row.name);
    const marketPrice = assetSymbol ? marketPricesByAssetSymbol[assetSymbol] : null;
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

async function calculateNetContributionUsdSince(userId, since, usdCnyRate) {
  const [previousPositionsResult, transactionsResult] = await Promise.all([
    pool.query(
      `
        SELECT DISTINCT ON (asset_id) asset_id, position_after
        FROM transactions
        WHERE user_id = $1
          AND transacted_at < $2
        ORDER BY asset_id, transacted_at DESC, id DESC
      `,
      [userId, since.toISOString()]
    ),
    pool.query(
      `
        SELECT asset_id, currency, transaction_type, quantity, unit_price, position_after, transacted_at, id
        FROM transactions
        WHERE user_id = $1
          AND transacted_at >= $2
        ORDER BY transacted_at ASC, id ASC
      `,
      [userId, since.toISOString()]
    ),
  ]);

  const previousPositionByAssetId = new Map();
  for (let i = 0; i < previousPositionsResult.rows.length; i += 1) {
    const row = previousPositionsResult.rows[i];
    previousPositionByAssetId.set(row.asset_id, Number(row.position_after) || 0);
  }

  let netContributionUsd = 0;
  for (let i = 0; i < transactionsResult.rows.length; i += 1) {
    const row = transactionsResult.rows[i];
    const assetId = String(row.asset_id || "").trim();
    const previousPosition = previousPositionByAssetId.get(assetId) || 0;
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unit_price);
    const nextPosition = Number(row.position_after);
    const currency = String(row.currency || "").trim().toUpperCase() === "CNY" ? "CNY" : "USD";
    const type = String(row.transaction_type || "").trim().toLowerCase();

    let deltaQuantity = 0;
    if (type === "buy") {
      deltaQuantity = Number.isFinite(quantity) ? quantity : 0;
    } else if (type === "sell") {
      deltaQuantity = Number.isFinite(quantity) ? -quantity : 0;
    } else if (type === "set" && Number.isFinite(nextPosition)) {
      deltaQuantity = nextPosition - previousPosition;
    }

    if (assetId) {
      previousPositionByAssetId.set(assetId, Number.isFinite(nextPosition) ? nextPosition : previousPosition);
    }

    if (!Number.isFinite(unitPrice) || !Number.isFinite(deltaQuantity) || deltaQuantity === 0) {
      continue;
    }

    const contributionBase = deltaQuantity * unitPrice;
    netContributionUsd += currency === "CNY" ? contributionBase / usdCnyRate : contributionBase;
  }

  return netContributionUsd;
}

async function calculatePortfolioDailySummary(userId) {
  const usdCnyRate = await fetchUsdCnyRate();
  const currentSnapshot = await calculatePortfolioSnapshot(userId);

  if (!currentSnapshot) {
    return {
      baselineCapturedAt: null,
      baselineTotalUsd: 0,
      currentTotalUsd: 0,
      dailyPnlPct: 0,
      dailyPnlUsd: 0,
      netContributionUsd: 0,
    };
  }

  const baselineTarget = getTwentyFourHoursAgo();
  const baselineResult = await pool.query(
    `
      SELECT total_usd, captured_at
      FROM portfolio_value_snapshots
      WHERE user_id = $1
        AND captured_at <= $2
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [userId, baselineTarget.toISOString()]
  );

  if (baselineResult.rowCount === 0) {
    return {
      baselineCapturedAt: null,
      baselineTotalUsd: currentSnapshot.totalUsd,
      currentTotalUsd: currentSnapshot.totalUsd,
      dailyPnlPct: 0,
      dailyPnlUsd: 0,
      netContributionUsd: 0,
    };
  }

  const baselineRow = baselineResult.rows[0];
  const baselineCapturedAt = new Date(baselineRow.captured_at);
  const baselineTotalUsd = Number(baselineRow.total_usd) || 0;
  const netContributionUsd = await calculateNetContributionUsdSince(userId, baselineCapturedAt, usdCnyRate);
  const dailyPnlUsd = currentSnapshot.totalUsd - baselineTotalUsd - netContributionUsd;
  const dailyPnlPct = baselineTotalUsd > 0 ? (dailyPnlUsd / baselineTotalUsd) * 100 : 0;

  return {
    baselineCapturedAt: baselineCapturedAt.toISOString(),
    baselineTotalUsd,
    currentTotalUsd: currentSnapshot.totalUsd,
    dailyPnlPct,
    dailyPnlUsd,
    netContributionUsd,
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

router.get("/summary", requireAuth, async (req, res) => {
  try {
    await recordPortfolioSnapshotForUser(req.userId);
    const summary = await calculatePortfolioDailySummary(req.userId);

    return res.json({
      ok: true,
      summary,
    });
  } catch (error) {
    console.error("Failed to read portfolio daily summary:", error);
    return res.status(500).json({ error: "Failed to read portfolio daily summary" });
  }
});

module.exports = {
  buildFxRateResponse,
  router,
  recordPortfolioSnapshotForUser,
};
