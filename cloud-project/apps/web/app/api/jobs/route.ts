import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (user instanceof NextResponse) return user;

  const result = await db.query(
    `SELECT id as job_id, source_url, target_language, status, created_at
     FROM jobs
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id]
  );

  return NextResponse.json(result.rows);
}
