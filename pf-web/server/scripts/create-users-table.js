const { Client } = require("pg");
require("dotenv").config();

const createUsersTableSql = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing in environment variables.");
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query(createUsersTableSql);
    console.log("Users table is ready (created or already exists).");
  } catch (error) {
    console.error("Failed to create users table:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
