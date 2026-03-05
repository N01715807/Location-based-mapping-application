import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const uid = await getAuthedUserId();
  return NextResponse.json({ ok: true, authed: !!uid, userId: uid });
}