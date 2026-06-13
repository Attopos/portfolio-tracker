const pool = require("../db");

async function findUserById(userId) {
  const result = await pool.query(
    "SELECT id, google_sub, email, name, avatar_url, created_at, updated_at FROM users WHERE id = $1",
    [userId]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function findOrCreateUserFromGoogle(googleProfile) {
  const existingResult = await pool.query(
    "SELECT * FROM users WHERE google_sub = $1",
    [googleProfile.sub]
  );

  if (existingResult.rowCount > 0) {
    return existingResult.rows[0];
  }

  const insertResult = await pool.query(
    `
      INSERT INTO users (google_sub, email, name, avatar_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `,
    [
      googleProfile.sub,
      googleProfile.email,
      googleProfile.name,
      googleProfile.picture,
    ]
  );
  return insertResult.rows[0];
}

module.exports = {
  findOrCreateUserFromGoogle,
  findUserById,
};
