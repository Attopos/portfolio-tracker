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

module.exports = router;
