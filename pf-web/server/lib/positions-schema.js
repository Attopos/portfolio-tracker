const pool = require("../db");

let ensureManualMarketPriceColumnPromise = null;

async function ensureManualMarketPriceColumn() {
  if (!ensureManualMarketPriceColumnPromise) {
    ensureManualMarketPriceColumnPromise = pool.query(`
      ALTER TABLE positions
      ADD COLUMN IF NOT EXISTS manual_market_price NUMERIC
    `).catch((error) => {
      ensureManualMarketPriceColumnPromise = null;
      throw error;
    });
  }

  await ensureManualMarketPriceColumnPromise;
}

module.exports = {
  ensureManualMarketPriceColumn,
};
