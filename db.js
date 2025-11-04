const { Pool } = require("pg");
const config = require("./db_config");

const pool = new Pool(config);

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

module.exports = {
  pool: pool,
  query: (text, params) => pool.query(text, params),
};
