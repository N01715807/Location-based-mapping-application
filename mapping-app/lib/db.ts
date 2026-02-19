import mysql from "mysql2/promise";

declare global {
  var __mysqlPool: mysql.Pool | undefined;
}

export function getPool() {
  if (!global.__mysqlPool) {
    global.__mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE,
      connectionLimit: 5,
    });
  }
  return global.__mysqlPool;
}