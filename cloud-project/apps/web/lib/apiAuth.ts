import { NextRequest, NextResponse } from "next/server";
import { decodeToken, getBearerToken } from "./auth";

export function requireUser(req: NextRequest): { id: string; email: string } | NextResponse {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }
  const user = decodeToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  return user;
}
