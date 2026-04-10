import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, expensesTable, dealsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import type { AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function serializeExpense(expense: typeof expensesTable.$inferSelect, dealBrandName: string | null, dealCampaignName: string | null) {
  return {
    ...expense,
    amount: expense.amount?.toString() ?? "0",
    dealBrandName,
    dealCampaignName,
  };
}

router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { deal_id, category } = req.query;

  let whereClause;
  if (deal_id) {
    whereClause = and(eq(expensesTable.userId, authReq.user.id), eq(expensesTable.dealId, parseInt(deal_id as string, 10)));
  } else if (category) {
    whereClause = and(eq(expensesTable.userId, authReq.user.id), eq(expensesTable.category, category as string));
  } else {
    whereClause = eq(expensesTable.userId, authReq.user.id);
  }

  const expenses = await db.select({
    expense: expensesTable,
    dealBrandName: dealsTable.brandName,
    dealCampaignName: dealsTable.campaignName,
  })
    .from(expensesTable)
    .leftJoin(dealsTable, eq(expensesTable.dealId, dealsTable.id))
    .where(whereClause)
    .orderBy(sql`${expensesTable.expenseDate} DESC`);

  res.json(expenses.map(({ expense, dealBrandName, dealCampaignName }) =>
    serializeExpense(expense, dealBrandName ?? null, dealCampaignName ?? null)
  ));
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { dealId, title, category, amount, currency, expenseDate, notes, isRecurring, recurringFrequency, vendorOrPayee } = req.body;

  if (!title || !category || !amount || !expenseDate) {
    res.status(400).json({ error: "title, category, amount, and expenseDate are required" });
    return;
  }

  const [expense] = await db.insert(expensesTable).values({
    userId: authReq.user.id,
    dealId: dealId ?? null,
    title,
    category,
    amount: amount.toString(),
    currency: currency ?? authReq.user.currency,
    expenseDate: new Date(expenseDate),
    notes: notes ?? null,
    isRecurring: isRecurring ?? false,
    recurringFrequency: recurringFrequency ?? null,
    vendorOrPayee: vendorOrPayee ?? null,
  }).returning();

  let dealBrandName: string | null = null;
  let dealCampaignName: string | null = null;
  if (expense.dealId) {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, expense.dealId));
    dealBrandName = deal?.brandName ?? null;
    dealCampaignName = deal?.campaignName ?? null;
  }

  res.status(201).json(serializeExpense(expense, dealBrandName, dealCampaignName));
});

router.patch("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid expense ID" });
    return;
  }

  const [existing] = await db.select().from(expensesTable).where(and(eq(expensesTable.id, id), eq(expensesTable.userId, authReq.user.id)));
  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (req.body.dealId !== undefined) updates.dealId = req.body.dealId;
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.amount !== undefined) updates.amount = req.body.amount.toString();
  if (req.body.currency !== undefined) updates.currency = req.body.currency;
  if (req.body.expenseDate !== undefined) updates.expenseDate = new Date(req.body.expenseDate);
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  if (req.body.isRecurring !== undefined) updates.isRecurring = req.body.isRecurring;
  if (req.body.recurringFrequency !== undefined) updates.recurringFrequency = req.body.recurringFrequency;
  if (req.body.vendorOrPayee !== undefined) updates.vendorOrPayee = req.body.vendorOrPayee;

  const [expense] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, id)).returning();

  let dealBrandName: string | null = null;
  let dealCampaignName: string | null = null;
  if (expense.dealId) {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, expense.dealId));
    dealBrandName = deal?.brandName ?? null;
    dealCampaignName = deal?.campaignName ?? null;
  }

  res.json(serializeExpense(expense, dealBrandName, dealCampaignName));
});

router.delete("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid expense ID" });
    return;
  }

  const [expense] = await db.delete(expensesTable).where(and(eq(expensesTable.id, id), eq(expensesTable.userId, authReq.user.id))).returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
