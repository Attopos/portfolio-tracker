require("dotenv").config();
const pool = require("../db");

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid VARCHAR NOT NULL PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
    ON user_sessions (expire);
  `);

  console.log("user_sessions table is ready.");
}

main()
  .catch((error) => {
    console.error("Failed to create sessions table:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
