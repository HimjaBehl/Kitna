import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword, generateToken, storeToken, removeToken, requireAuth } from "../lib/auth";
import type { AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const { name, email, password, role = "creator", currency = "INR" } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    currency,
  }).returning();

  const token = generateToken();
  await storeToken(token, user.id);

  req.log.info({ userId: user.id }, "User signed up");

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      currency: user.currency,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken();
  await storeToken(token, user.id);

  req.log.info({ userId: user.id }, "User logged in");

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      currency: user.currency,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    await removeToken(authHeader.slice(7));
  }
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const user = authReq.user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    currency: user.currency,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

router.patch("/auth/me/settings", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { name, currency, role } = req.body;

  const updates: Record<string, string> = {};
  if (name) updates.name = name;
  if (currency) updates.currency = currency;
  if (role) updates.role = role;

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, authReq.user.id))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    currency: updated.currency,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

export default router;
