import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, name, type, latitude, longitude, status
       FROM water_resources
       ORDER BY id ASC`
    );

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load water resources" },
      { status: 500 }
    );
  }
}
