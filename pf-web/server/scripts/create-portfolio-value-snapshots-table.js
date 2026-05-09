require("dotenv").config();
const pool = require("../db");

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_value_snapshots (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_usd NUMERIC NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS portfolio_value_snapshots_user_captured_idx
    ON portfolio_value_snapshots (user_id, captured_at);
  `);

  console.log("portfolio_value_snapshots table is ready.");
}

main()
  .catch((error) => {
    console.error("Failed to create portfolio_value_snapshots table:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
