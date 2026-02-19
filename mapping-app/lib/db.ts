import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      socketPath: process.env.MYSQL_SOCKET,
      user: process.env.MYSQL_USER,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

