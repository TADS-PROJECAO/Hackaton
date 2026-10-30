const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("ERRO: configure DATABASE_URL no arquivo .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
