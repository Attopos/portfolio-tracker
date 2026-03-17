const { Client } = require("pg");
require("dotenv").config();

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing in environment variables.");
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query("BEGIN");

    const firstUserResult = await client.query("SELECT id FROM users ORDER BY id ASC LIMIT 1");
    if (firstUserResult.rowCount === 0) {
      throw new Error("No users found. Sign in once first to create a local user.");
    }
    const fallbackUserId = firstUserResult.rows[0].id;

    await client.query("ALTER TABLE positions ADD COLUMN IF NOT EXISTS user_id BIGINT");
    await client.query("UPDATE positions SET user_id = $1 WHERE user_id IS NULL", [fallbackUserId]);
    await client.query("ALTER TABLE positions ALTER COLUMN user_id SET NOT NULL");

    const fkResult = await client.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'positions_user_id_fkey' AND conrelid = 'positions'::regclass"
    );
    if (fkResult.rowCount === 0) {
      await client.query(
        "ALTER TABLE positions ADD CONSTRAINT positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
      );
    }

    const pkResult = await client.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'positions_pkey' AND conrelid = 'positions'::regclass"
    );
    if (pkResult.rowCount > 0) {
      const pkDef = String(pkResult.rows[0].def || "");
      if (pkDef.includes("(id)") && !pkDef.includes("user_id")) {
        await client.query("ALTER TABLE positions DROP CONSTRAINT positions_pkey");
        await client.query("ALTER TABLE positions ADD CONSTRAINT positions_pkey PRIMARY KEY (user_id, id)");
      }
    } else {
      await client.query("ALTER TABLE positions ADD CONSTRAINT positions_pkey PRIMARY KEY (user_id, id)");
    }

    await client.query("COMMIT");
    console.log("Positions table is now bound to user_id.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError.message);
    }
    console.error("Failed to migrate positions table:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
