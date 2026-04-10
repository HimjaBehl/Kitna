import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, dealsTable, paymentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import type { AuthRequest } from "../lib/auth";

const router: IRouter = Router();

const GST_THRESHOLD = 2000000;

router.get("/compliance", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.id;
  const currency = authReq.user.currency ?? "INR";

  const deals = await db.select().from(dealsTable).where(eq(dealsTable.userId, userId));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.userId, userId));

  const totalPaymentsReceived = payments.reduce((s, p) => s + parseFloat(p.amountReceived?.toString() ?? "0"), 0);

  const tdsDeals = deals.filter(d => d.tdsApplicable);
  const tdsDeducted = tdsDeals.reduce((s, d) => s + parseFloat(d.tdsAmount?.toString() ?? "0"), 0);

  const paymentTdsDeducted = payments.filter(p => p.tdsApplicable).reduce((s, p) => s + parseFloat(p.tdsAmount?.toString() ?? "0"), 0);

  const totalTds = tdsDeducted + paymentTdsDeducted;
  const totalTdsDeals = tdsDeals.length + payments.filter(p => p.tdsApplicable).length;

  const barterDeals = deals.filter(d => d.isBarter);
  const barterValue = barterDeals.reduce((s, d) => {
    return s + parseFloat(d.barterEstimatedValue?.toString() ?? "0");
  }, 0);

  const taxableRevenue = deals.filter(d => d.gstApplicable || d.taxableFlag).reduce((s, d) => {
    const tv = d.taxableValue ? parseFloat(d.taxableValue.toString()) : parseFloat(d.amountAgreed?.toString() ?? "0");
    return s + tv;
  }, 0);

  const gstThresholdProgress = Math.min((taxableRevenue / GST_THRESHOLD) * 100, 100);
  let gstAlertLevel = "safe";
  if (gstThresholdProgress >= 100) gstAlertLevel = "exceeded";
  else if (gstThresholdProgress >= 80) gstAlertLevel = "warning";
  else if (gstThresholdProgress >= 50) gstAlertLevel = "approaching";

  const invoicesPending = deals.filter(d => d.invoiceStatus === "raised" || d.invoiceStatus === "sent").length;
  const invoicesRaised = deals.filter(d => d.invoiceStatus !== "not_raised" && d.invoiceStatus !== "draft").length;
  const invoicesPaid = deals.filter(d => d.invoiceStatus === "paid").length;

  res.json({
    taxableRevenue: taxableRevenue.toFixed(2),
    gstThreshold: GST_THRESHOLD.toFixed(2),
    gstThresholdProgress: Math.round(gstThresholdProgress * 10) / 10,
    gstAlertLevel,
    tdsDeducted: totalTds.toFixed(2),
    tdsDeals: totalTdsDeals,
    barterValue: barterValue.toFixed(2),
    barterDeals: barterDeals.length,
    invoicesPending,
    invoicesRaised,
    invoicesPaid,
    currency,
  });
});

export default router;
