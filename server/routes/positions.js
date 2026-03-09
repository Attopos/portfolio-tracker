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

router.delete("/:id", async (req, res) => {
  const assetId = String(req.params.id || "").trim();

  if (!assetId) {
    return res.status(400).json({ error: "Asset id is required" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM positions WHERE id = $1 RETURNING id, name, currency, position, price",
      [assetId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Position not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to delete position in database:", error);
    return res.status(500).json({ error: "Failed to delete position" });
  }
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const assetId = String(body.id || "").trim();
  const name = String(body.name || "").trim();
  const currency = String(body.currency || "").trim().toUpperCase();
  const position = Number(body.position);
  const price = Number(body.price);

  if (!assetId) {
    return res.status(400).json({ error: "Asset id is required" });
  }

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  if (currency !== "USD" && currency !== "CNY") {
    return res.status(400).json({ error: "Currency must be USD or CNY" });
  }

  if (!Number.isFinite(position)) {
    return res.status(400).json({ error: "Position must be a finite number" });
  }

  if (!Number.isFinite(price)) {
    return res.status(400).json({ error: "Price must be a finite number" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO positions (id, name, currency, position, price) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, currency, position, price",
      [assetId, name, currency, position, price]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error && error.code === "23505") {
      return res.status(400).json({ error: "Asset id already exists" });
    }

    console.error("Failed to create position in database:", error);
    return res.status(500).json({ error: "Failed to create position" });
  }
});

module.exports = router;
