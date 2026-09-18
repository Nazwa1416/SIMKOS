const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL belum diatur di Vercel.');
    }

    pool = mysql.createPool(process.env.DATABASE_URL);
  }

  return pool;
}

module.exports = getPool;