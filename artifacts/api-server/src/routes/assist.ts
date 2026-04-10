import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, extractionDraftsTable, dealsTable, paymentsTable, expensesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and CSV files are allowed"));
    }
  },
});

const EXTRACT_SYSTEM_PROMPT = `You are a financial assistant for Indian Instagram influencers, YouTubers, UGC creators, and content managers. You analyze screenshots (WhatsApp messages, emails, invoices, affiliate dashboard, payout screenshots) and extract structured deal/payment/expense information.

Return ONLY valid JSON, no markdown or explanation. Extract whatever you can find. If a field is unclear or missing, set it to null. Be conservative with confidence: only say "high" if multiple key fields are clearly visible.

JSON schema:
{
  "entry_type": "deal" | "payment" | "expense" | "barter" | "unknown",
  "brand_name": string | null,
  "campaign_name": string | null,
  "income_type": "brand_collab" | "ugc" | "affiliate" | "platform_payout" | "retainer" | "subscription" | "barter" | "other" | null,
  "amount": number | null,
  "currency": "INR" | "USD" | "EUR" | null,
  "date_detected": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "payment_status": "paid" | "pending" | "partial" | null,
  "platform_source": string | null,
  "description": string | null,
  "is_barter": boolean,
  "counterparty": string | null,
  "confidence": "high" | "medium" | "low",
  "missing_fields": string[],
  "reasoning_summary": string
}`;

router.post("/assist/extract-image", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype;

  let extracted: Record<string, unknown> = {};

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
            },
            {
              type: "text",
              text: "Analyze this screenshot and extract deal/payment/expense information for an Indian content creator. Return only the JSON object.",
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch (err) {
    console.error("OpenAI extraction error:", err);
    extracted = {
      entry_type: "unknown",
      confidence: "low",
      reasoning_summary: "Could not analyze the image. Please fill in the details manually.",
      missing_fields: ["brand_name", "amount", "date_detected"],
    };
  }

  const [draft] = await db
    .insert(extractionDraftsTable)
    .values({
      userId: authReq.user.id,
      sourceType: "image",
      entryType: (extracted.entry_type as string) ?? "unknown",
      extractedJson: extracted,
      confidence: (extracted.confidence as string) ?? "low",
      status: "draft",
    })
    .returning();

  res.json({ draft, extracted });
});

router.post("/assist/create-entry", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { draftId, entryType, data } = req.body;

  if (!entryType || !data) {
    res.status(400).json({ error: "entryType and data required" });
    return;
  }

  let created: Record<string, unknown> = {};

  if (entryType === "deal" || entryType === "barter") {
    const [deal] = await db.insert(dealsTable).values({
      userId: authReq.user.id,
      brandName: data.brandName ?? "Unknown Brand",
      campaignName: data.campaignName ?? "Campaign",
      incomeType: data.incomeType ?? "brand_collab",
      amountAgreed: data.amount ?? "0",
      currency: data.currency ?? "INR",
      isBarter: entryType === "barter",
      barterEstimatedValue: entryType === "barter" ? (data.amount ?? null) : null,
      startDate: data.dateDetected ? new Date(data.dateDetected) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.description ?? null,
      status: "active",
    }).returning();
    created = deal as Record<string, unknown>;
  } else if (entryType === "payment") {
    const [payment] = await db.insert(paymentsTable).values({
      userId: authReq.user.id,
      dealId: data.dealId ?? null,
      amountReceived: data.amount ?? "0",
      currency: data.currency ?? "INR",
      paymentMethod: data.paymentMethod ?? "bank_transfer",
      receivedDate: data.dateDetected ? new Date(data.dateDetected) : new Date(),
      notes: data.description ?? null,
    }).returning();
    created = payment as Record<string, unknown>;
  } else if (entryType === "expense") {
    const [expense] = await db.insert(expensesTable).values({
      userId: authReq.user.id,
      dealId: data.dealId ?? null,
      title: data.description ?? data.brandName ?? "Expense",
      category: data.category ?? "other",
      amount: data.amount ?? "0",
      currency: data.currency ?? "INR",
      expenseDate: data.dateDetected ? new Date(data.dateDetected) : new Date(),
      notes: null,
    }).returning();
    created = expense as Record<string, unknown>;
  } else {
    res.status(400).json({ error: "Unsupported entry type" });
    return;
  }

  if (draftId) {
    await db.update(extractionDraftsTable)
      .set({ status: "confirmed" })
      .where(eq(extractionDraftsTable.id, draftId));
  }

  res.json({ success: true, created });
});

router.post("/assist/discard-draft", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { draftId } = req.body;

  if (!draftId) {
    res.status(400).json({ error: "draftId required" });
    return;
  }

  await db.update(extractionDraftsTable)
    .set({ status: "discarded" })
    .where(eq(extractionDraftsTable.id, draftId));

  res.json({ success: true });
});

router.get("/assist/activity", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;

  const drafts = await db.select()
    .from(extractionDraftsTable)
    .where(eq(extractionDraftsTable.userId, authReq.user.id))
    .orderBy(desc(extractionDraftsTable.createdAt))
    .limit(50);

  res.json(drafts);
});

router.post("/assist/import-csv", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;

  if (!req.file) {
    res.status(400).json({ error: "No CSV file uploaded" });
    return;
  }

  const text = req.file.buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    return;
  }

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["\s]/g, ""));
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  }).filter(r => Object.values(r).some(v => v));

  res.json({ headers, rows: rows.slice(0, 100), totalRows: rows.length });
});

router.post("/assist/import-csv-confirm", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { rows, mapping, importType } = req.body;

  if (!rows || !Array.isArray(rows) || !mapping) {
    res.status(400).json({ error: "rows and mapping required" });
    return;
  }

  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      if (importType === "deals") {
        await db.insert(dealsTable).values({
          userId: authReq.user.id,
          brandName: row[mapping.brandName] ?? "Unknown",
          campaignName: row[mapping.campaignName] ?? "Campaign",
          amountAgreed: row[mapping.amount] ?? "0",
          currency: row[mapping.currency] ?? "INR",
          incomeType: row[mapping.incomeType] ?? "brand_collab",
          startDate: row[mapping.startDate] ? new Date(row[mapping.startDate]) : null,
          dueDate: row[mapping.dueDate] ? new Date(row[mapping.dueDate]) : null,
          status: "active",
        });
      } else {
        await db.insert(paymentsTable).values({
          userId: authReq.user.id,
          amountReceived: row[mapping.amount] ?? "0",
          currency: row[mapping.currency] ?? "INR",
          paymentMethod: row[mapping.paymentMethod] ?? "bank_transfer",
          receivedDate: row[mapping.date] ? new Date(row[mapping.date]) : new Date(),
          notes: row[mapping.notes] ?? null,
        });
      }
      imported++;
    } catch {
      errors.push(`Row ${imported + errors.length + 1} failed`);
    }
  }

  res.json({ imported, errors });
});

export default router;
