const BASE = import.meta.env.BASE_URL;

function getToken() {
  return localStorage.getItem("kitna_token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ExtractionResult {
  entry_type: "deal" | "payment" | "expense" | "barter" | "unknown";
  brand_name: string | null;
  campaign_name: string | null;
  income_type: string | null;
  amount: number | null;
  currency: string | null;
  date_detected: string | null;
  due_date: string | null;
  payment_status: string | null;
  platform_source: string | null;
  description: string | null;
  is_barter: boolean;
  counterparty: string | null;
  confidence: "high" | "medium" | "low";
  missing_fields: string[];
  reasoning_summary: string;
}

export interface ExtractionDraft {
  id: number;
  userId: number;
  sourceType: string;
  entryType: string;
  rawFileUrl: string | null;
  extractedJson: ExtractionResult | null;
  confidence: string;
  status: "draft" | "confirmed" | "discarded";
  createdAt: string;
  updatedAt: string;
}

export async function extractImage(file: File): Promise<{ draft: ExtractionDraft; extracted: ExtractionResult }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}api/assist/extract-image`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createEntry(payload: {
  draftId?: number;
  entryType: string;
  data: Record<string, unknown>;
}) {
  const res = await fetch(`${BASE}api/assist/create-entry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function discardDraft(draftId: number) {
  const res = await fetch(`${BASE}api/assist/discard-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ draftId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getActivity(): Promise<ExtractionDraft[]> {
  const res = await fetch(`${BASE}api/assist/activity`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadCsv(file: File): Promise<{ headers: string[]; rows: Record<string, string>[]; totalRows: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}api/assist/import-csv`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmCsvImport(payload: {
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  importType: "deals" | "payments";
}) {
  const res = await fetch(`${BASE}api/assist/import-csv-confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
