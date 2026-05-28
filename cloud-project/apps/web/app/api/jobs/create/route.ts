import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { publishJob } from "@/lib/queue";

const schema = z.object({
  source_url: z.string().url(),
  target_language: z.string().min(2).max(8)
});

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existingUser = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1",
    [user.id]
  );
  if (!existingUser.rows[0]) {
    return NextResponse.json(
      { error: "User no longer exists in current database. Please login again." },
      { status: 401 }
    );
  }

  const insert = await db.query<{ id: string }>(
    `INSERT INTO jobs (user_id, source_url, target_language, status, progress_percentage)
     VALUES ($1, $2, $3, 'PENDING', 0)
     RETURNING id`,
    [user.id, parsed.data.source_url, parsed.data.target_language]
  );

  const jobId = insert.rows[0].id;
  await publishJob({
    job_id: jobId,
    source_url: parsed.data.source_url,
    target_language: parsed.data.target_language
  });

  return NextResponse.json({ job_id: jobId, status: "PENDING" }, { status: 202 });
}
