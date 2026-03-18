const express = require("express");
const pool = require("../db");
const { buildGeneratedAssetId } = require("../lib/assets");
const { requireAuth } = require("../middleware/require-auth");
const { recordPortfolioSnapshotForUser } = require("./portfolio-history");

const router = express.Router();

const ALLOWED_TRANSACTION_TYPES = new Set(["buy", "sell", "set"]);
const ALLOWED_CURRENCIES = new Set(["USD", "CNY"]);

async function safeRecordPortfolioSnapshot(userId) {
  try {
    await recordPortfolioSnapshotForUser(userId);
  } catch (error) {
    console.error("Failed to record portfolio snapshot:", error);
  }
}

function normalizeTransactionType(value) {
  const type = String(value || "")
    .trim()
    .toLowerCase();
  return ALLOWED_TRANSACTION_TYPES.has(type) ? type : "";
}

function normalizeCurrency(value) {
  const currency = String(value || "")
    .trim()
    .toUpperCase();
  return ALLOWED_CURRENCIES.has(currency) ? currency : "";
}

function buildTransactionResponse(row) {
  return {
    id: Number(row.id),
    assetId: row.asset_id,
    assetName: row.asset_name,
    currency: row.currency,
    type: row.transaction_type,
    quantity: Number(row.quantity),
    unitPrice: row.unit_price === null ? null : Number(row.unit_price),
    positionAfter: Number(row.position_after),
    transactedAt: row.transacted_at,
    createdAt: row.created_at,
  };
}

function createRequestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function computeNextPosition(currentPosition, transactionType, quantity) {
  if (transactionType === "set") {
    return quantity;
  }

  if (transactionType === "buy") {
    return currentPosition + quantity;
  }

  if (transactionType === "sell") {
    return currentPosition - quantity;
  }

  throw createRequestError(400, "Unsupported transaction type");
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, asset_id, asset_name, currency, transaction_type, quantity, unit_price, position_after, transacted_at, created_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY transacted_at DESC, id DESC
        LIMIT 25
      `,
      [req.userId]
    );

    return res.json({
      ok: true,
      transactions: result.rows.map(buildTransactionResponse),
    });
  } catch (error) {
    console.error("Failed to read transactions:", error);
    return res.status(500).json({ error: "Failed to read transactions" });
  }
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const type = normalizeTransactionType(body.type);
  const requestedAssetId = String(body.assetId || "").trim();
  const assetNameInput = String(body.assetName || "").trim();
  const currencyInput = normalizeCurrency(body.currency);
  const quantity = Number(body.quantity);
  const unitPriceValue = body.unitPrice;
  const unitPrice = unitPriceValue === "" || unitPriceValue === null || typeof unitPriceValue === "undefined"
    ? null
    : Number(unitPriceValue);
  const transactedAt = String(body.transactedAt || "").trim();

  if (!type) {
    return res.status(400).json({ error: "Transaction type must be buy, sell, or set" });
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity must be a non-negative number" });
  }

  if ((type === "buy" || type === "sell") && quantity <= 0) {
    return res.status(400).json({ error: "Buy and sell quantities must be greater than zero" });
  }

  if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
    return res.status(400).json({ error: "Unit price must be empty or a non-negative number" });
  }

  let transactedAtIso = new Date().toISOString();
  if (transactedAt) {
    const parsed = new Date(transactedAt);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "Transaction date is invalid" });
    }
    transactedAtIso = parsed.toISOString();
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let assetId = requestedAssetId;
    let assetName = assetNameInput;
    let currency = currencyInput;
    let currentPosition = 0;
    let currentPrice = 0;
    let positionExists = false;

    if (assetId) {
      const existingPositionResult = await client.query(
        `
          SELECT id, name, currency, position, price
          FROM positions
          WHERE user_id = $1 AND id = $2
          FOR UPDATE
        `,
        [req.userId, assetId]
      );

      if (existingPositionResult.rowCount > 0) {
        const existing = existingPositionResult.rows[0];
        positionExists = true;
        assetName = String(existing.name || "").trim();
        currency = String(existing.currency || "").trim().toUpperCase();
        currentPosition = Number(existing.position) || 0;
        currentPrice = Number(existing.price) || 0;
      }
    }

    if (!positionExists) {
      if (!assetName) {
        throw createRequestError(400, "Asset name is required for a new holding");
      }

      if (!currency) {
        throw createRequestError(400, "Currency is required for a new holding");
      }

      if (!assetId) {
        assetId = buildGeneratedAssetId(assetName);
      }
    }

    let nextPosition = quantity;
    if (type === "buy") {
      nextPosition = currentPosition + quantity;
    } else if (type === "sell") {
      nextPosition = currentPosition - quantity;
    }

    if (nextPosition < 0) {
      throw createRequestError(400, "Transaction would make position negative");
    }

    const nextPrice = unitPrice !== null ? unitPrice : currentPrice;

    if (nextPosition === 0) {
      await client.query("DELETE FROM positions WHERE user_id = $1 AND id = $2", [req.userId, assetId]);
    } else if (positionExists) {
      await client.query(
        `
          UPDATE positions
          SET position = $1, price = $2
          WHERE user_id = $3 AND id = $4
        `,
        [nextPosition, nextPrice, req.userId, assetId]
      );
    } else {
      await client.query(
        `
          INSERT INTO positions (user_id, id, name, currency, position, price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [req.userId, assetId, assetName, currency, nextPosition, nextPrice]
      );
    }

    const transactionResult = await client.query(
      `
        INSERT INTO transactions (
          user_id, asset_id, asset_name, currency, transaction_type, quantity, unit_price, position_after, transacted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, asset_id, asset_name, currency, transaction_type, quantity, unit_price, position_after, transacted_at, created_at
      `,
      [req.userId, assetId, assetName, currency, type, quantity, unitPrice, nextPosition, transactedAtIso]
    );

    await client.query("COMMIT");
    await safeRecordPortfolioSnapshot(req.userId);

    return res.status(201).json({
      ok: true,
      transaction: buildTransactionResponse(transactionResult.rows[0]),
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback transaction write:", rollbackError);
    }
    if (Number.isInteger(error && error.statusCode)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Failed to create transaction:", error);
    return res.status(500).json({ error: "Failed to create transaction" });
  } finally {
    client.release();
  }
});

router.delete("/:transactionId", async (req, res) => {
  const transactionId = Number(req.params.transactionId);
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return res.status(400).json({ error: "Transaction id is invalid" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const targetResult = await client.query(
      `
        SELECT id, asset_id, asset_name, currency
        FROM transactions
        WHERE user_id = $1 AND id = $2
      `,
      [req.userId, transactionId]
    );

    if (targetResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found" });
    }

    const target = targetResult.rows[0];

    await client.query("DELETE FROM transactions WHERE user_id = $1 AND id = $2", [req.userId, transactionId]);

    const remainingResult = await client.query(
      `
        SELECT id, transaction_type, quantity, unit_price, transacted_at
        FROM transactions
        WHERE user_id = $1 AND asset_id = $2
        ORDER BY transacted_at ASC, id ASC
      `,
      [req.userId, target.asset_id]
    );

    let nextPosition = 0;
    let latestUnitPrice = null;

    for (const row of remainingResult.rows) {
      const quantity = Number(row.quantity) || 0;
      nextPosition = computeNextPosition(nextPosition, row.transaction_type, quantity);

      if (nextPosition < 0) {
        throw createRequestError(400, "Transaction history would make position negative");
      }

      if (row.unit_price !== null) {
        latestUnitPrice = Number(row.unit_price);
      }

      await client.query("UPDATE transactions SET position_after = $1 WHERE id = $2 AND user_id = $3", [
        nextPosition,
        row.id,
        req.userId,
      ]);
    }

    if (remainingResult.rowCount === 0 || nextPosition === 0) {
      await client.query("DELETE FROM positions WHERE user_id = $1 AND id = $2", [req.userId, target.asset_id]);
    } else {
      await client.query(
        `
          INSERT INTO positions (user_id, id, name, currency, position, price)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, id) DO UPDATE
          SET
            name = EXCLUDED.name,
            currency = EXCLUDED.currency,
            position = EXCLUDED.position,
            price = EXCLUDED.price
        `,
        [
          req.userId,
          target.asset_id,
          target.asset_name,
          target.currency,
          nextPosition,
          latestUnitPrice === null || !Number.isFinite(latestUnitPrice) ? 0 : latestUnitPrice,
        ]
      );
    }

    await client.query("COMMIT");
    await safeRecordPortfolioSnapshot(req.userId);
    return res.json({ ok: true });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback transaction delete:", rollbackError);
    }
    if (Number.isInteger(error && error.statusCode)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Failed to delete transaction:", error);
    return res.status(500).json({ error: "Failed to delete transaction" });
  } finally {
    client.release();
  }
});

module.exports = router;
