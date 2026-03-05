import { cookies } from "next/headers";
import { getPool } from "@/lib/db";

export const COOKIE_NAME = "session_token";
export const SESSION_DAYS = 7;

export async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const pool = getPool();
  const [rows]: any = await pool.query(
    `SELECT user_id
     FROM app_sessions
     WHERE token = ? AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  const r = rows?.[0];
  return r?.user_id ? Number(r.user_id) : null;
}

export async function requireAuth(): Promise<number> {
  const uid = await getAuthedUserId();
  if (!uid) throw new Error("UNAUTHORIZED");
  return uid;
}