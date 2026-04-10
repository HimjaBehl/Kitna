import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, tokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "kitna_salt_2024").digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function storeToken(token: string, userId: number): Promise<void> {
  await db.insert(tokensTable).values({ token, userId });
}

export async function getUserIdFromToken(token: string): Promise<number | null> {
  const [row] = await db.select({ userId: tokensTable.userId }).from(tokensTable).where(eq(tokensTable.token, token));
  return row?.userId ?? null;
}

export async function removeToken(token: string): Promise<void> {
  await db.delete(tokensTable).where(eq(tokensTable.token, token));
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = await getUserIdFromToken(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  (req as Request & { user: typeof user }).user = user;
  next();
}

export type AuthRequest = Request & { user: { id: number; name: string; email: string; role: string; currency: string; createdAt: Date; updatedAt: Date } };
