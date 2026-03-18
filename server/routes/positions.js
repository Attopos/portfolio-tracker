const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/require-auth");
const { recordPortfolioSnapshotForUser } = require("./portfolio-history");

const router = express.Router();

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
    const result = await pool.query(
      "SELECT id, name, currency, position, price FROM positions WHERE user_id = $1 ORDER BY id",
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
    await safeRecordPortfolioSnapshot(req.userId);
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
