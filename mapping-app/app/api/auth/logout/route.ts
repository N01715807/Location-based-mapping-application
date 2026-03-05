import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const pool = getPool();
    await pool.execute("DELETE FROM app_sessions WHERE token = ?", [token]);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}