import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, paymentsTable, dealsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import type { AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function serializePayment(payment: typeof paymentsTable.$inferSelect, dealBrandName: string | null, dealCampaignName: string | null) {
  return {
    ...payment,
    amountReceived: payment.amountReceived?.toString() ?? "0",
    tdsAmount: payment.tdsAmount?.toString() ?? null,
    dealBrandName,
    dealCampaignName,
  };
}

router.get("/payments", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { deal_id } = req.query;

  const payments = await db.select({
    payment: paymentsTable,
    dealBrandName: dealsTable.brandName,
    dealCampaignName: dealsTable.campaignName,
  })
    .from(paymentsTable)
    .leftJoin(dealsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(
      deal_id
        ? and(eq(paymentsTable.userId, authReq.user.id), eq(paymentsTable.dealId, parseInt(deal_id as string, 10)))
        : eq(paymentsTable.userId, authReq.user.id)
    )
    .orderBy(sql`${paymentsTable.receivedDate} DESC`);

  res.json(payments.map(({ payment, dealBrandName, dealCampaignName }) =>
    serializePayment(payment, dealBrandName ?? null, dealCampaignName ?? null)
  ));
});

router.post("/payments", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { dealId, amountReceived, currency, paymentMethod, receivedDate, notes, tdsApplicable, tdsAmount } = req.body;

  if (!amountReceived || !paymentMethod || !receivedDate) {
    res.status(400).json({ error: "amountReceived, paymentMethod, and receivedDate are required" });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values({
    userId: authReq.user.id,
    dealId: dealId ?? null,
    amountReceived: amountReceived.toString(),
    currency: currency ?? authReq.user.currency,
    paymentMethod,
    receivedDate: new Date(receivedDate),
    notes: notes ?? null,
    tdsApplicable: tdsApplicable ?? false,
    tdsAmount: tdsAmount ? tdsAmount.toString() : null,
  }).returning();

  let dealBrandName: string | null = null;
  let dealCampaignName: string | null = null;
  if (payment.dealId) {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, payment.dealId));
    dealBrandName = deal?.brandName ?? null;
    dealCampaignName = deal?.campaignName ?? null;
  }

  res.status(201).json(serializePayment(payment, dealBrandName, dealCampaignName));
});

router.patch("/payments/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid payment ID" });
    return;
  }

  const [existing] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.id, id), eq(paymentsTable.userId, authReq.user.id)));
  if (!existing) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (req.body.dealId !== undefined) updates.dealId = req.body.dealId;
  if (req.body.amountReceived !== undefined) updates.amountReceived = req.body.amountReceived.toString();
  if (req.body.currency !== undefined) updates.currency = req.body.currency;
  if (req.body.paymentMethod !== undefined) updates.paymentMethod = req.body.paymentMethod;
  if (req.body.receivedDate !== undefined) updates.receivedDate = new Date(req.body.receivedDate);
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  if (req.body.tdsApplicable !== undefined) updates.tdsApplicable = req.body.tdsApplicable;
  if (req.body.tdsAmount !== undefined) updates.tdsAmount = req.body.tdsAmount !== null ? req.body.tdsAmount.toString() : null;

  const [payment] = await db.update(paymentsTable).set(updates).where(eq(paymentsTable.id, id)).returning();

  let dealBrandName: string | null = null;
  let dealCampaignName: string | null = null;
  if (payment.dealId) {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, payment.dealId));
    dealBrandName = deal?.brandName ?? null;
    dealCampaignName = deal?.campaignName ?? null;
  }

  res.json(serializePayment(payment, dealBrandName, dealCampaignName));
});

router.delete("/payments/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid payment ID" });
    return;
  }

  const [payment] = await db.delete(paymentsTable).where(and(eq(paymentsTable.id, id), eq(paymentsTable.userId, authReq.user.id))).returning();

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
