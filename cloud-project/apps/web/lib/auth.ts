import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { db } from "./db";
import { env } from "./env";

export type AuthUser = {
  id: string;
  email: string;
};

export async function login(email: string, password: string): Promise<string | null> {
  const result = await db.query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email]
  );
  if (!result.rows[0]) return null;

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  return jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, { expiresIn: "24h" });
}

export function decodeToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; email: string };
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}
