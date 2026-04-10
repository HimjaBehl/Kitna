import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lte, lt, or, isNull } from "drizzle-orm";
import { db, dealsTable, paymentsTable, expensesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import type { AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function computeDealStatus(amountAgreed: string, totalReceived: string, dueDate: Date | null, currentStatus: string): string {
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

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const uid = authReq.user.id;

  const dealsData = await db.select({
    deal: dealsTable,
    totalReceived: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(and(eq(dealsTable.userId, uid), sql`${dealsTable.status} != 'cancelled'`, sql`${dealsTable.status} != 'draft'`, eq(dealsTable.isBarter, false)))
    .groupBy(dealsTable.id);

  let totalBooked = 0;
  let totalReceived = 0;
  let pendingReceivables = 0;
  let overdueCount = 0;
  let activeDealsCount = 0;

  for (const { deal, totalReceived: tr } of dealsData) {
    const agreed = parseFloat(deal.amountAgreed?.toString() ?? "0");
    const received = parseFloat(tr ?? "0");
    const status = computeDealStatus(agreed.toString(), received.toString(), deal.dueDate, deal.status);

    totalBooked += agreed;
    totalReceived += received;
    if (status !== "paid" && status !== "cancelled") {
      pendingReceivables += Math.max(agreed - received, 0);
    }
    if (status === "overdue") overdueCount++;
    if (status === "active" || status === "pending_payment" || status === "partially_paid") activeDealsCount++;
  }

  const [expenseRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)::text`,
  }).from(expensesTable).where(eq(expensesTable.userId, uid));

  const totalExpenses = parseFloat(expenseRow?.total ?? "0");
  const netProfit = totalReceived - totalExpenses;
  const potentialProfit = totalBooked - totalExpenses;

  res.json({
    totalBooked: totalBooked.toFixed(2),
    totalReceived: totalReceived.toFixed(2),
    pendingReceivables: pendingReceivables.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    netProfit: netProfit.toFixed(2),
    potentialProfit: potentialProfit.toFixed(2),
    overdueCount,
    activeDealsCount,
    currency: authReq.user.currency,
  });
});

router.get("/dashboard/monthly-trend", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const uid = authReq.user.id;

  const months: { month: string; received: string; expenses: string; booked: string }[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthLabel = d.toLocaleString("default", { month: "short", year: "numeric" });

    const [receivedRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
    }).from(paymentsTable).where(
      and(eq(paymentsTable.userId, uid), gte(paymentsTable.receivedDate, start), lte(paymentsTable.receivedDate, end))
    );

    const [expenseRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)::text`,
    }).from(expensesTable).where(
      and(eq(expensesTable.userId, uid), gte(expensesTable.expenseDate, start), lte(expensesTable.expenseDate, end))
    );

    const [bookedRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${dealsTable.amountAgreed}), 0)::text`,
    }).from(dealsTable).where(
      and(eq(dealsTable.userId, uid), gte(dealsTable.createdAt, start), lte(dealsTable.createdAt, end), eq(dealsTable.isBarter, false))
    );

    months.push({
      month: monthLabel,
      received: parseFloat(receivedRow?.total ?? "0").toFixed(2),
      expenses: parseFloat(expenseRow?.total ?? "0").toFixed(2),
      booked: parseFloat(bookedRow?.total ?? "0").toFixed(2),
    });
  }

  res.json(months);
});

router.get("/dashboard/income-by-type", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const uid = authReq.user.id;

  const rows = await db.select({
    type: dealsTable.incomeType,
    amount: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
    count: sql<number>`COUNT(DISTINCT ${dealsTable.id})::int`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(eq(dealsTable.userId, uid))
    .groupBy(dealsTable.incomeType);

  res.json(rows.map(r => ({
    type: r.type,
    amount: parseFloat(r.amount ?? "0").toFixed(2),
    count: r.count,
  })));
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const uid = authReq.user.id;

  const deals = await db.select({
    deal: dealsTable,
    totalReceived: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(eq(dealsTable.userId, uid))
    .groupBy(dealsTable.id)
    .orderBy(sql`${dealsTable.createdAt} DESC`)
    .limit(5);

  const payments = await db.select({
    payment: paymentsTable,
    dealBrandName: dealsTable.brandName,
    dealCampaignName: dealsTable.campaignName,
  })
    .from(paymentsTable)
    .leftJoin(dealsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(eq(paymentsTable.userId, uid))
    .orderBy(sql`${paymentsTable.receivedDate} DESC`)
    .limit(5);

  const expenses = await db.select({
    expense: expensesTable,
    dealBrandName: dealsTable.brandName,
    dealCampaignName: dealsTable.campaignName,
  })
    .from(expensesTable)
    .leftJoin(dealsTable, eq(expensesTable.dealId, dealsTable.id))
    .where(eq(expensesTable.userId, uid))
    .orderBy(sql`${expensesTable.expenseDate} DESC`)
    .limit(5);

  res.json({
    deals: deals.map(({ deal, totalReceived }) => ({
      ...deal,
      amountAgreed: deal.amountAgreed?.toString() ?? "0",
      barterEstimatedValue: deal.barterEstimatedValue?.toString() ?? null,
      totalReceived: totalReceived ?? "0",
      status: computeDealStatus(deal.amountAgreed?.toString() ?? "0", totalReceived ?? "0", deal.dueDate, deal.status),
    })),
    payments: payments.map(({ payment, dealBrandName, dealCampaignName }) => ({
      ...payment,
      amountReceived: payment.amountReceived?.toString() ?? "0",
      dealBrandName: dealBrandName ?? null,
      dealCampaignName: dealCampaignName ?? null,
    })),
    expenses: expenses.map(({ expense, dealBrandName, dealCampaignName }) => ({
      ...expense,
      amount: expense.amount?.toString() ?? "0",
      dealBrandName: dealBrandName ?? null,
      dealCampaignName: dealCampaignName ?? null,
    })),
  });
});

router.get("/receivables", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const uid = authReq.user.id;
  const now = new Date();

  const dealsData = await db.select({
    deal: dealsTable,
    totalReceived: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(and(
      eq(dealsTable.userId, uid),
      sql`${dealsTable.status} != 'cancelled'`,
      eq(dealsTable.isBarter, false),
    ))
    .groupBy(dealsTable.id)
    .orderBy(dealsTable.dueDate);

  const receivables = dealsData
    .map(({ deal, totalReceived: tr }) => {
      const agreed = parseFloat(deal.amountAgreed?.toString() ?? "0");
      const received = parseFloat(tr ?? "0");
      const pending = Math.max(agreed - received, 0);
      const status = computeDealStatus(agreed.toString(), received.toString(), deal.dueDate, deal.status);

      if (status === "paid" || pending <= 0) return null;

      const daysPending = deal.dueDate
        ? Math.floor((now.getTime() - deal.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        dealId: deal.id,
        brandName: deal.brandName,
        campaignName: deal.campaignName,
        amountAgreed: agreed.toFixed(2),
        totalReceived: received.toFixed(2),
        pendingAmount: pending.toFixed(2),
        currency: deal.currency,
        dueDate: deal.dueDate,
        daysPending,
        status,
        incomeType: deal.incomeType,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      return (b.daysPending ?? -999) - (a.daysPending ?? -999);
    });

  res.json(receivables);
});

router.get("/profit", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const uid = authReq.user.id;

  const dealsData = await db.select({
    deal: dealsTable,
    totalReceived: sql<string>`COALESCE(SUM(${paymentsTable.amountReceived}), 0)::text`,
    linkedExpenses: sql<string>`0`,
  })
    .from(dealsTable)
    .leftJoin(paymentsTable, eq(paymentsTable.dealId, dealsTable.id))
    .where(and(eq(dealsTable.userId, uid), eq(dealsTable.isBarter, false), sql`${dealsTable.status} != 'cancelled'`))
    .groupBy(dealsTable.id)
    .orderBy(sql`SUM(${paymentsTable.amountReceived}) DESC NULLS LAST`);

  let totalBooked = 0;
  let totalReceived = 0;
  let pendingReceivables = 0;

  const topDeals = [];
  for (const { deal, totalReceived: tr } of dealsData) {
    const agreed = parseFloat(deal.amountAgreed?.toString() ?? "0");
    const received = parseFloat(tr ?? "0");
    const status = computeDealStatus(agreed.toString(), received.toString(), deal.dueDate, deal.status);

    totalBooked += agreed;
    totalReceived += received;
    if (status !== "paid") pendingReceivables += Math.max(agreed - received, 0);

    const [expRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)::text`,
    }).from(expensesTable).where(and(eq(expensesTable.userId, uid), eq(expensesTable.dealId, deal.id)));

    const linkedExpensesAmt = parseFloat(expRow?.total ?? "0");
    const netValue = received - linkedExpensesAmt;

    topDeals.push({
      dealId: deal.id,
      brandName: deal.brandName,
      campaignName: deal.campaignName,
      amountAgreed: agreed.toFixed(2),
      totalReceived: received.toFixed(2),
      linkedExpenses: linkedExpensesAmt.toFixed(2),
      netValue: netValue.toFixed(2),
      status,
    });
  }

  const [expenseRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)::text`,
  }).from(expensesTable).where(eq(expensesTable.userId, uid));

  const totalExpenses = parseFloat(expenseRow?.total ?? "0");
  const netProfit = totalReceived - totalExpenses;
  const potentialProfit = totalBooked - totalExpenses;

  const expenseCategoryRows = await db.select({
    category: expensesTable.category,
    amount: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)::text`,
  }).from(expensesTable).where(eq(expensesTable.userId, uid)).groupBy(expensesTable.category).orderBy(sql`SUM(${expensesTable.amount}) DESC`);

  const expensesByCategory = expenseCategoryRows.map(r => ({
    category: r.category,
    amount: parseFloat(r.amount ?? "0").toFixed(2),
    percentage: totalExpenses > 0 ? ((parseFloat(r.amount ?? "0") / totalExpenses) * 100).toFixed(1) : "0",
  }));

  res.json({
    totalBooked: totalBooked.toFixed(2),
    totalReceived: totalReceived.toFixed(2),
    pendingReceivables: pendingReceivables.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    netProfit: netProfit.toFixed(2),
    potentialProfit: potentialProfit.toFixed(2),
    expensesByCategory,
    topDeals: topDeals.slice(0, 10),
    currency: authReq.user.currency,
  });
});

export default router;
