import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getPool } from "@/lib/db";
import { COOKIE_NAME, SESSION_DAYS } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "username/password required" }, { status: 400 });
  }

  const pool = getPool();
  const [rows]: any = await pool.query(
    "SELECT id, password_hash FROM app_users WHERE username = ? LIMIT 1",
    [username]
  );

  const u = rows?.[0];
  if (!u) return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });

  const ok = await bcrypt.compare(password, String(u.password_hash));
  if (!ok) return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);

  await pool.execute(
    "INSERT INTO app_sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
    [u.id, token, expiresAt]
  );

  const res = NextResponse.json({ ok: true });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 3600,
  });

  return res;
}