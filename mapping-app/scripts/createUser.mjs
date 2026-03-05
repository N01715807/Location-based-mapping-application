import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.log("Usage: node scripts/createUser.mjs <username> <password>");
  process.exit(1);
}

console.log("ENV", {
  MYSQL_HOST: process.env.MYSQL_HOST,
  MYSQL_PORT: process.env.MYSQL_PORT,
  MYSQL_USER: process.env.MYSQL_USER,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
});

async function main() {
  const hash = await bcrypt.hash(password, 10);

  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE,
  });

  await pool.execute(
    "INSERT INTO app_users (username, password_hash) VALUES (?, ?)",
    [username, hash]
  );

  console.log("User created:", username);
  process.exit(0);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});