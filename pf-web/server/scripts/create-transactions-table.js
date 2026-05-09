require("dotenv").config();
const pool = require("../db");

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL,
      asset_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      unit_price NUMERIC,
      position_after NUMERIC NOT NULL,
      transacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS transactions_user_transacted_idx
    ON transactions (user_id, transacted_at DESC, id DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS transactions_user_asset_idx
    ON transactions (user_id, asset_id);
  `);

  console.log("transactions table is ready.");
}

main()
  .catch((error) => {
    console.error("Failed to create transactions table:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
