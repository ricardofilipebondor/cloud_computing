import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { deleteSubtitleFile } from "@/lib/storage";

type Params = {
  params: { job_id: string };
};

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = requireUser(req);
  if (user instanceof NextResponse) return user;

  const existing = await db.query<{ srt_path: string | null; vtt_path: string | null }>(
    "SELECT srt_path, vtt_path FROM jobs WHERE id = $1 AND user_id = $2",
    [params.job_id, user.id]
  );

  if (!existing.rows[0]) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await deleteSubtitleFile(existing.rows[0].srt_path ?? "");
  await deleteSubtitleFile(existing.rows[0].vtt_path ?? "");

  await db.query("DELETE FROM jobs WHERE id = $1 AND user_id = $2", [params.job_id, user.id]);
  return new NextResponse(null, { status: 204 });
}
