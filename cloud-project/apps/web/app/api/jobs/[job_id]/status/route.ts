import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = {
  params: { job_id: string };
};

export async function GET(req: NextRequest, { params }: Params) {
  const user = requireUser(req);
  if (user instanceof NextResponse) return user;

  const result = await db.query(
    `SELECT id as job_id, status, progress_percentage
     FROM jobs
     WHERE id = $1 AND user_id = $2`,
    [params.job_id, user.id]
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}
