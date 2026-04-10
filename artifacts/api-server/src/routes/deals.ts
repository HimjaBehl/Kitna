import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, dealsTable, paymentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import type { AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function computeDealStatus(
  amountAgreed: string,
  totalReceived: string,
  dueDate: Date | null,
  currentStatus: string
): string {
  if (currentStatus === "cancelled" || currentStatus === "draft") return currentStatus;

  const agreed = parseFloat(amountAgreed);
  const received = parseFloat(totalReceived);
  const now = new Date();

  if (received >= agreed && agreed > 0) return "paid";
  if (received > 0 && received < agreed) return "partially_paid";
  if (received === 0 && dueDate && dueDate < now) return "overdue";
  if (received === 0) return "pending_payment";
  return currentStatus;
}

function serializeDeal(deal: typeof dealsTable.$inferSelect, totalReceived: string) {
  return {
    ...deal,
    amountAgreed: deal.amountAgreed?.toString() ?? "0",
    barterEstimatedValue: deal.barterEstimatedValue?.toString() ?? null,
    invoiceAmount: deal.invoiceAmount?.toString() ?? null,
    managerCutValue: deal.managerCutValue?.toString() ?? null,
    agencyCutValue: deal.agencyCutValue?.toString() ?? null,
    taxableValue: deal.taxableValue?.toString() ?? null,
    tdsAmount: deal.tdsAmount?.toString() ?? null,
    totalReceived,
    status: computeDealStatus(deal.amountAgreed?.toString() ?? "0", totalReceived, deal.dueDate, deal.status),
  };
}

router.get("/deals", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { status, income_type, search } = req.query;

  const deals = await db.select({
    deal: dealsTable,
    totalReceived: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(eq(dealsTable.userId, authReq.user.id))
    .groupBy(dealsTable.id)
    .orderBy(sql`${dealsTable.createdAt} DESC`);

  const result = deals
    .map(({ deal, totalReceived }) => serializeDeal(deal, totalReceived ?? "0"))
    .filter((d) => {
      if (status && d.status !== status) return false;
      if (income_type && d.incomeType !== income_type) return false;
      if (search) {
        const s = (search as string).toLowerCase();
        if (!d.brandName.toLowerCase().includes(s) && !d.campaignName.toLowerCase().includes(s)) return false;
      }
      return true;
    });

  res.json(result);
});

router.post("/deals", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const {
    brandName, campaignName, incomeType, amountAgreed, currency,
    isBarter, barterEstimatedValue, barterDescription, taxableFlag,
    startDate, dueDate, notes,
    invoiceNumber, invoiceDate, invoiceStatus, invoiceAmount,
    managerCutType, managerCutValue, agencyCutType, agencyCutValue,
    gstApplicable, taxableValue, tdsApplicable, tdsAmount,
  } = req.body;

  if (!brandName || !campaignName || !incomeType || !amountAgreed) {
    res.status(400).json({ error: "brandName, campaignName, incomeType, and amountAgreed are required" });
    return;
  }

  const [deal] = await db.insert(dealsTable).values({
    userId: authReq.user.id,
    brandName,
    campaignName,
    incomeType,
    amountAgreed: amountAgreed.toString(),
    currency: currency ?? authReq.user.currency,
    status: "active",
    isBarter: isBarter ?? false,
    barterEstimatedValue: barterEstimatedValue ? barterEstimatedValue.toString() : null,
    barterDescription: barterDescription ?? null,
    taxableFlag: taxableFlag ?? false,
    startDate: startDate ? new Date(startDate) : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    notes: notes ?? null,
    invoiceNumber: invoiceNumber ?? null,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
    invoiceStatus: invoiceStatus ?? "not_raised",
    invoiceAmount: invoiceAmount ? invoiceAmount.toString() : null,
    managerCutType: managerCutType ?? null,
    managerCutValue: managerCutValue ? managerCutValue.toString() : null,
    agencyCutType: agencyCutType ?? null,
    agencyCutValue: agencyCutValue ? agencyCutValue.toString() : null,
    gstApplicable: gstApplicable ?? false,
    taxableValue: taxableValue ? taxableValue.toString() : null,
    tdsApplicable: tdsApplicable ?? false,
    tdsAmount: tdsAmount ? tdsAmount.toString() : null,
  }).returning();

  res.status(201).json(serializeDeal(deal, "0"));
});

router.get("/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid deal ID" });
    return;
  }

  const [dealRow] = await db.select({
    deal: dealsTable,
    totalReceived: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(and(eq(dealsTable.id, id), eq(dealsTable.userId, authReq.user.id)))
    .groupBy(dealsTable.id);

  if (!dealRow) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.dealId, id));

  res.json({
    ...serializeDeal(dealRow.deal, dealRow.totalReceived ?? "0"),
    payments: payments.map(p => ({
      ...p,
      amountReceived: p.amountReceived?.toString() ?? "0",
      tdsAmount: p.tdsAmount?.toString() ?? null,
      dealBrandName: null,
      dealCampaignName: null,
    })),
  });
});

router.patch("/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid deal ID" });
    return;
  }

  const [existing] = await db.select().from(dealsTable).where(and(eq(dealsTable.id, id), eq(dealsTable.userId, authReq.user.id)));
  if (!existing) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const simpleFields = [
    "brandName", "campaignName", "incomeType", "currency", "status",
    "isBarter", "taxableFlag", "barterDescription",
    "invoiceNumber", "invoiceStatus",
    "managerCutType", "agencyCutType",
    "gstApplicable", "tdsApplicable",
    "notes",
  ];
  for (const field of simpleFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const numericFields = ["amountAgreed", "barterEstimatedValue", "invoiceAmount", "managerCutValue", "agencyCutValue", "taxableValue", "tdsAmount"];
  for (const field of numericFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field] !== null ? req.body[field].toString() : null;
  }

  if (req.body.startDate !== undefined) updates.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
  if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
  if (req.body.invoiceDate !== undefined) updates.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : null;

  const [deal] = await db.update(dealsTable).set(updates).where(eq(dealsTable.id, id)).returning();

  const [totalRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
  }).from(paymentsTable).where(eq(paymentsTable.dealId, id));

  res.json(serializeDeal(deal, totalRow?.total ?? "0"));
});

router.delete("/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid deal ID" });
    return;
  }

  const [deal] = await db.delete(dealsTable).where(and(eq(dealsTable.id, id), eq(dealsTable.userId, authReq.user.id))).returning();

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
