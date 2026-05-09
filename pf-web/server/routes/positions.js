const express = require("express");
const pool = require("../db");
const { ensureManualMarketPriceColumn } = require("../lib/positions-schema");
const { requireAuth } = require("../middleware/require-auth");
const { invalidatePortfolioSnapshotsForUser, recordPortfolioSnapshotForUser } = require("./portfolio-history");

const router = express.Router();

async function safeRefreshPortfolioSnapshots(userId) {
  try {
    await invalidatePortfolioSnapshotsForUser(userId);
    await recordPortfolioSnapshotForUser(userId);
  } catch (error) {
    console.error("Failed to refresh portfolio snapshots:", error);
  }
}

async function safeRecordPortfolioSnapshot(userId) {
  try {
    await recordPortfolioSnapshotForUser(userId);
  } catch (error) {
    console.error("Failed to record portfolio snapshot:", error);
  }
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    await ensureManualMarketPriceColumn();
    const result = await pool.query(
      `
        SELECT id, name, currency, position, price, manual_market_price
        FROM positions
        WHERE user_id = $1
        ORDER BY id
      `,
      [req.userId]
    );
    await safeRecordPortfolioSnapshot(req.userId);
    return res.json({
      ok: true,
      positions: result.rows,
    });
  } catch (error) {
    console.error("Failed to read positions from database:", error);
    return res.status(500).json({ error: "Failed to read positions" });
  }
});

router.put("/:assetId", async (req, res) => {
  const assetId = String(req.params.assetId || "").trim();
  if (!assetId) {
    return res.status(400).json({ error: "Asset id is required" });
  }

  const rawPosition = req.body?.position;
  const rawManualMarketPrice = req.body?.manualMarketPrice;
  const position =
    rawPosition === "" || rawPosition === null || typeof rawPosition === "undefined"
      ? null
      : Number(rawPosition);
  const manualMarketPrice =
    rawManualMarketPrice === "" || rawManualMarketPrice === null || typeof rawManualMarketPrice === "undefined"
      ? null
      : Number(rawManualMarketPrice);

  if (position !== null && (!Number.isFinite(position) || position < 0)) {
    return res.status(400).json({ error: "Position must be empty or a non-negative number" });
  }

  if (manualMarketPrice !== null && (!Number.isFinite(manualMarketPrice) || manualMarketPrice < 0)) {
    return res.status(400).json({ error: "Manual market price must be empty or a non-negative number" });
  }

  const client = await pool.connect();

  try {
    await ensureManualMarketPriceColumn();
    await client.query("BEGIN");
    const currentResult = await client.query(
      `
        SELECT id, name, currency, position, price, manual_market_price
        FROM positions
        WHERE user_id = $1 AND id = $2
        FOR UPDATE
      `,
      [req.userId, assetId]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Holding not found" });
    }

    const currentPosition = Number(currentResult.rows[0].position) || 0;
    const nextPosition = position === null ? currentPosition : position;
    const result = await client.query(
      `
        UPDATE positions
        SET
          position = COALESCE($1, position),
          manual_market_price = $2
        WHERE user_id = $3 AND id = $4
        RETURNING id, name, currency, position, price, manual_market_price
      `,
      [position, manualMarketPrice, req.userId, assetId]
    );

    if (position !== null && nextPosition !== currentPosition) {
      const row = result.rows[0];
      await client.query(
        `
          INSERT INTO transactions (
            user_id, asset_id, asset_name, currency, transaction_type, quantity, unit_price, position_after, transacted_at
          )
          VALUES ($1, $2, $3, $4, 'set', $5, $6, $7, NOW())
        `,
        [
          req.userId,
          row.id,
          row.name,
          row.currency,
          nextPosition,
          Number(row.price) || 0,
          nextPosition,
        ]
      );
    }

    await client.query("COMMIT");
    await safeRefreshPortfolioSnapshots(req.userId);
    return res.json({
      ok: true,
      position: result.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback holding update:", rollbackError);
    }
    console.error("Failed to update holding:", error);
    return res.status(500).json({ error: "Failed to update holding" });
  } finally {
    client.release();
  }
});

router.delete("/:assetId", async (req, res) => {
  const assetId = String(req.params.assetId || "").trim();
  if (!assetId) {
    return res.status(400).json({ error: "Asset id is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM transactions WHERE user_id = $1 AND asset_id = $2", [req.userId, assetId]);
    const result = await client.query("DELETE FROM positions WHERE user_id = $1 AND id = $2", [req.userId, assetId]);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Holding not found" });
    }

    await client.query("COMMIT");
    await safeRefreshPortfolioSnapshots(req.userId);
    return res.json({ ok: true });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback holding delete:", rollbackError);
    }
    console.error("Failed to delete holding:", error);
    return res.status(500).json({ error: "Failed to delete holding" });
  } finally {
    client.release();
  }
});

module.exports = router;
