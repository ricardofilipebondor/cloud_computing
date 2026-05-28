import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { readSubtitleFile } from "@/lib/storage";

type Params = {
  params: { job_id: string };
};

export async function GET(req: NextRequest, { params }: Params) {
  const user = requireUser(req);
  if (user instanceof NextResponse) return user;

  const format = req.nextUrl.searchParams.get("format") ?? "srt";
  if (format !== "srt" && format !== "vtt") {
    return NextResponse.json({ error: "format must be srt or vtt" }, { status: 400 });
  }

  const result = await db.query<{ srt_path: string | null; vtt_path: string | null; status: string }>(
    `SELECT srt_path, vtt_path, status
     FROM jobs
     WHERE id = $1 AND user_id = $2`,
    [params.job_id, user.id]
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (result.rows[0].status !== "COMPLETED") {
    return NextResponse.json({ error: "Job not completed yet" }, { status: 409 });
  }

  const path = format === "srt" ? result.rows[0].srt_path : result.rows[0].vtt_path;
  if (!path) {
    return NextResponse.json({ error: "Subtitle not available" }, { status: 404 });
  }

  const content = await readSubtitleFile(path);
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.job_id}.${format}"`
    }
  });
}
