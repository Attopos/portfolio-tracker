const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, currency, position, price FROM positions ORDER BY id"
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Failed to read positions from database:", error);
    return res.status(500).json({ error: "Failed to read positions" });
  }
});

router.put("/:id", async (req, res) => {
  const assetId = String(req.params.id || "").trim();
  const nextPosition = Number(req.body && req.body.position);

  if (!assetId) {
    return res.status(400).json({ error: "Asset id is required" });
  }

  if (!Number.isFinite(nextPosition)) {
    return res.status(400).json({ error: "Position must be a finite number" });
  }

  try {
    const result = await pool.query(
      "UPDATE positions SET position = $1 WHERE id = $2 RETURNING id, name, currency, position, price",
      [nextPosition, assetId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Position not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update position in database:", error);
    return res.status(500).json({ error: "Failed to update position" });
  }
});

module.exports = router;
