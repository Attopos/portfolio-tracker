const { Pool, types } = require("pg");
require("dotenv").config();

// By default the pg driver returns NUMERIC/DECIMAL columns as strings to avoid
// precision loss. The web client (JS) coerces those transparently, but strictly
// typed clients like the iOS app expect JSON numbers and fail to decode strings.
// Parse NUMERIC (OID 1700) as a float so every endpoint emits real numbers.
// Our values (quantities, prices, portfolio totals) are well within float64 range.
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
