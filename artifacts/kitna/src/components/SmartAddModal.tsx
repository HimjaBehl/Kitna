import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Upload, FileText, Mail, Sparkles, AlertCircle, CheckCircle2, Pencil, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractImage, createEntry, discardDraft, uploadCsv, confirmCsvImport, type ExtractionResult } from "@/lib/assist";
import { formatCurrency, incomeTypeLabel } from "@/lib/format";
import { QUERY_KEYS, DASHBOARD_KEYS } from "@/lib/queryKeys";

type Tab = "image" | "csv" | "email";
type Stage = "upload" | "analyzing" | "review" | "csv-preview" | "csv-map" | "csv-success";

interface ReviewForm {
  entryType: string;
  brandName: string;
  campaignName: string;
  incomeType: string;
  amount: string;
  currency: string;
  dateDetected: string;
  dueDate: string;
  description: string;
  paymentMethod: string;
  category: string;
}

const INCOME_TYPES = ["brand_collab", "ugc", "affiliate", "platform_payout", "retainer", "subscription", "barter", "other"];
const CATEGORIES = ["editing", "production", "travel", "styling", "props", "ads", "software", "equipment", "freelancers", "manager_commission", "tax", "other"];
const PAYMENT_METHODS = ["bank_transfer", "upi", "platform_payout", "gateway", "cash", "other"];
const ENTRY_TYPES = ["deal", "payment", "expense", "barter"];

function inp(extra = "") {
  return `w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/20 placeholder:text-[#9CA3AF] ${extra}`;
}
function lbl() { return "text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider block mb-1.5"; }

function ConfidencePill({ level }: { level: string }) {
  const map = { high: "bg-[#F0FDF4] text-[#15803D] border-[#22C55E]/20", medium: "bg-amber-50 text-amber-700 border-amber-200", low: "bg-[#F8FAFC] text-[#9CA3AF] border-[#E5E7EB]" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${map[level as keyof typeof map] ?? map.low}`}>{level} confidence</span>;
}

export function SmartAddModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("image");
  const [stage, setStage] = useState<Stage>("upload");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [form, setForm] = useState<ReviewForm>({
    entryType: "deal", brandName: "", campaignName: "", incomeType: "brand_collab",
    amount: "", currency: "INR", dateDetected: "", dueDate: "", description: "", paymentMethod: "bank_transfer", category: "other",
  });
  const [saving, setSaving] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[]; totalRows: number } | null>(null);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvImportType, setCsvImportType] = useState<"deals" | "payments">("deals");
  const [csvSuccess, setCsvSuccess] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const invalidateAll = async () => {
    for (const key of [QUERY_KEYS.deals, QUERY_KEYS.payments, QUERY_KEYS.expenses]) {
      qc.invalidateQueries({ queryKey: key });
    }
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const populateForm = (ex: ExtractionResult) => {
    setForm({
      entryType: ex.entry_type === "barter" ? "deal" : (ENTRY_TYPES.includes(ex.entry_type) ? ex.entry_type : "deal"),
      brandName: ex.brand_name ?? ex.counterparty ?? "",
      campaignName: ex.campaign_name ?? "",
      incomeType: ex.income_type && INCOME_TYPES.includes(ex.income_type) ? ex.income_type : (ex.entry_type === "barter" ? "barter" : "brand_collab"),
      amount: ex.amount != null ? String(ex.amount) : "",
      currency: ex.currency ?? "INR",
      dateDetected: ex.date_detected ?? "",
      dueDate: ex.due_date ?? "",
      description: ex.description ?? "",
      paymentMethod: "bank_transfer",
      category: "other",
    });
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStage("analyzing");
    try {
      const { draft, extracted: ex } = await extractImage(file);
      setExtracted(ex);
      setDraftId(draft.id);
      populateForm(ex);
      setStage("review");
    } catch (err) {
      toast.error("Could not analyze image. Please fill in the details manually.");
      setExtracted({ entry_type: "deal", brand_name: null, campaign_name: null, income_type: null, amount: null, currency: "INR", date_detected: null, due_date: null, payment_status: null, platform_source: null, description: null, is_barter: false, counterparty: null, confidence: "low", missing_fields: [], reasoning_summary: "Could not extract data from this image." });
      setStage("review");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, []);

  const handleCsvFile = async (file: File) => {
    try {
      const data = await uploadCsv(file);
      setCsvData(data);
      const autoMap: Record<string, string> = {};
      const DEAL_FIELDS = ["brandname", "brand", "campaignname", "campaign", "amount", "currency", "incometype", "startdate", "duedate"];
      data.headers.forEach(h => {
        const clean = h.toLowerCase().replace(/[^a-z]/g, "");
        DEAL_FIELDS.forEach(field => { if (clean.includes(field.replace(/[^a-z]/g, ""))) autoMap[field] = h; });
      });
      setCsvMapping(autoMap);
      setStage("csv-preview");
    } catch { toast.error("Could not parse CSV file"); }
  };

  const handleCreateEntry = async () => {
    if (!form.brandName && (form.entryType === "deal" || form.entryType === "barter")) { toast.error("Brand name is required"); return; }
    if (!form.amount) { toast.error("Amount is required"); return; }
    setSaving(true);
    try {
      await createEntry({
        draftId: draftId ?? undefined,
        entryType: form.entryType,
        data: {
          brandName: form.brandName, campaignName: form.campaignName, incomeType: form.incomeType,
          amount: form.amount, currency: form.currency, dateDetected: form.dateDetected || null,
          dueDate: form.dueDate || null, description: form.description, paymentMethod: form.paymentMethod, category: form.category,
        },
      });
      await invalidateAll();
      toast.success(`${form.entryType.charAt(0).toUpperCase() + form.entryType.slice(1)} created from screenshot`);
      onClose();
    } catch { toast.error("Failed to create entry"); } finally { setSaving(false); }
  };

  const handleDiscard = async () => {
    if (draftId) await discardDraft(draftId).catch(() => {});
    onClose();
  };

  const handleCsvImport = async () => {
    if (!csvData) return;
    setSaving(true);
    try {
      const result = await confirmCsvImport({ rows: csvData.rows, mapping: csvMapping, importType: csvImportType });
      await invalidateAll();
      setCsvSuccess(result);
      setStage("csv-success");
    } catch { toast.error("Import failed"); } finally { setSaving(false); }
  };

  const setF = (k: keyof ReviewForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F1F5F9] shrink-0">
          <div className="flex items-center gap-2.5">
            {stage !== "upload" && stage !== "csv-success" && (
              <button onClick={() => { setStage("upload"); setPreview(null); setExtracted(null); setDraftId(null); setCsvData(null); }} className="p-1 text-[#9CA3AF] hover:text-[#6B7280] mr-1 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-7 h-7 bg-[#F0FDF4] rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#22C55E]" />
            </div>
            <div>
              <h2 className="font-bold text-[#111827] text-base leading-tight">Smart Add</h2>
              <p className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">
                {stage === "upload" && "Upload a screenshot or import a CSV"}
                {stage === "analyzing" && "Analyzing your screenshot…"}
                {stage === "review" && "Here's what I found — edit before saving"}
                {stage === "csv-preview" && "Preview your CSV"}
                {stage === "csv-map" && "Map columns to fields"}
                {stage === "csv-success" && "Import complete!"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* UPLOAD STAGE */}
          {stage === "upload" && (
            <div className="p-6">
              {/* Tabs */}
              <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-xl mb-6">
                {([["image", "Screenshot", Upload], ["csv", "Import CSV", FileText], ["email", "Email", Mail]] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-white text-[#111827] shadow-sm" : "text-[#9CA3AF] hover:text-[#6B7280]"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {tab === "image" && (
                <div className="space-y-4">
                  {/* Source type chips */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Works with</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "WhatsApp", emoji: "💬" },
                        { label: "Email", emoji: "📧" },
                        { label: "Invoice", emoji: "🧾" },
                        { label: "Affiliate dashboard", emoji: "📊" },
                        { label: "Payout screenshot", emoji: "💸" },
                      ].map(s => (
                        <span key={s.label} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg text-[11px] font-medium text-[#374151]">
                          {s.emoji} {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl py-8 px-4 text-center cursor-pointer transition-all ${dragging ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E5E7EB] hover:border-[#22C55E]/50 hover:bg-[#F0FDF4]/20"}`}
                  >
                    <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-[#374151] font-semibold text-sm">Drop a screenshot here</p>
                    <p className="text-[#9CA3AF] text-xs mt-1">or click to browse</p>
                    <p className="text-[#D1D5DB] text-[10px] mt-2">PNG, JPG, WEBP · Max 20MB</p>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                  </div>
                  {/* Helper text */}
                  <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-4 py-3">
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">
                      Kitna will try to detect <span className="font-semibold text-[#374151]">brand name, amount, dates, and deal type</span> from your screenshot. You can always review and edit before saving.
                    </p>
                  </div>
                </div>
              )}

              {tab === "csv" && (
                <div className="space-y-4">
                  {/* Step guide */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { step: "1", label: "Upload your CSV", desc: "Deals or payments" },
                      { step: "2", label: "Map columns", desc: "Brand, Amount, Date…" },
                      { step: "3", label: "Import", desc: "Review & confirm" },
                    ].map(s => (
                      <div key={s.step} className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-3 text-center">
                        <div className="w-6 h-6 bg-[#2563EB]/10 rounded-full flex items-center justify-center mx-auto mb-1.5">
                          <span className="text-[10px] font-bold text-[#2563EB]">{s.step}</span>
                        </div>
                        <p className="text-[11px] font-semibold text-[#374151]">{s.label}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                  {/* Drop zone */}
                  <div
                    onClick={() => csvRef.current?.click()}
                    className="border-2 border-dashed border-[#E5E7EB] rounded-2xl py-8 px-4 text-center cursor-pointer hover:border-[#2563EB]/40 hover:bg-blue-50/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <p className="text-[#374151] font-semibold text-sm">Upload your CSV file</p>
                    <p className="text-[#9CA3AF] text-xs mt-1">Import deals or payments in bulk</p>
                    <p className="text-[#D1D5DB] text-[10px] mt-2">CSV format · Max 5MB</p>
                    <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
                  </div>
                  <div className="bg-[#EFF6FF] border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] text-[#2563EB] leading-relaxed">
                      Suggested columns: <span className="font-semibold">Brand Name, Amount, Campaign, Currency, Start Date, Due Date</span>
                    </p>
                  </div>
                </div>
              )}

              {tab === "email" && (
                <div className="space-y-4">
                  <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-8 text-center">
                    <div className="w-12 h-12 bg-white border border-[#E5E7EB] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Mail className="w-6 h-6 text-[#9CA3AF]" />
                    </div>
                    <p className="text-[#374151] font-bold text-sm">Forward emails to Kitna</p>
                    <p className="text-[#9CA3AF] text-xs mt-2 leading-relaxed max-w-[260px] mx-auto">
                      Forward brand briefs, invoices, and payment confirmations — Kitna will extract the details automatically.
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-xl px-4 py-2.5">
                      <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      <span className="text-[12px] text-[#9CA3AF] font-mono">add@kitna.app</span>
                      <span className="text-[9px] bg-[#F0FDF4] text-[#15803D] font-bold px-1.5 py-0.5 rounded border border-[#22C55E]/20">SOON</span>
                    </div>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-4 py-3">
                    <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                      You'll be able to forward brand deal emails, payment receipts, and invoices directly to your Kitna inbox for automatic capture.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANALYZING STAGE */}
          {stage === "analyzing" && (
            <div className="p-6 flex flex-col items-center justify-center py-16">
              {preview && <img src={preview} alt="Uploaded" className="w-32 h-32 object-cover rounded-2xl border border-[#E5E7EB] mb-6 shadow-md" />}
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin" />
                <p className="text-[#374151] font-semibold text-sm">Analyzing your screenshot…</p>
              </div>
              <p className="text-[#9CA3AF] text-xs mt-2">Looking for brand name, amount, dates, deal type</p>
            </div>
          )}

          {/* REVIEW STAGE */}
          {stage === "review" && extracted && (
            <div className="p-6 space-y-5">
              {/* Extraction summary */}
              <div className={`rounded-2xl border px-5 py-4 ${extracted.confidence === "high" ? "bg-[#F0FDF4] border-[#22C55E]/20" : extracted.confidence === "medium" ? "bg-amber-50 border-amber-200" : "bg-[#F8FAFC] border-[#E5E7EB]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {extracted.confidence !== "low" ? (
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                      )}
                      <p className="text-sm font-bold text-[#111827]">
                        {extracted.confidence === "low" ? "Couldn't extract much" : "Looks like a " + extracted.entry_type}
                      </p>
                      <ConfidencePill level={extracted.confidence} />
                    </div>
                    <p className="text-xs text-[#6B7280] ml-6">{extracted.reasoning_summary}</p>
                  </div>
                  {preview && <img src={preview} alt="Source" className="w-12 h-12 object-cover rounded-xl border border-[#E5E7EB] shrink-0" />}
                </div>
                {extracted.missing_fields?.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 ml-6">
                    <p className="text-[11px] text-[#9CA3AF]">Fill in: <span className="text-[#B45309] font-semibold">{extracted.missing_fields.slice(0, 4).join(", ")}</span></p>
                  </div>
                )}
              </div>

              {/* Editable form */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Edit before saving</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl()}>Type</label>
                    <select value={form.entryType} onChange={e => setF("entryType", e.target.value)} className={inp("bg-gray-50")}>
                      {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl()}>Currency</label>
                    <select value={form.currency} onChange={e => setF("currency", e.target.value)} className={inp("bg-gray-50")}>
                      {["INR", "USD", "EUR", "GBP"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {(form.entryType === "deal" || form.entryType === "barter") && (
                  <>
                    <div>
                      <label className={lbl()}>Brand / Client *</label>
                      <input value={form.brandName} onChange={e => setF("brandName", e.target.value)} className={inp()} placeholder="e.g. Boat Lifestyle" />
                    </div>
                    <div>
                      <label className={lbl()}>Deliverable / Campaign</label>
                      <input value={form.campaignName} onChange={e => setF("campaignName", e.target.value)} className={inp()} placeholder="e.g. 2 Reels + 1 YouTube" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={lbl()}>Income Type</label>
                        <select value={form.incomeType} onChange={e => setF("incomeType", e.target.value)} className={inp("bg-gray-50")}>
                          {INCOME_TYPES.map(t => <option key={t} value={t}>{incomeTypeLabel(t)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl()}>Deal Amount *</label>
                        <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                          <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm select-none">₹</span>
                          <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setF("amount", e.target.value)} placeholder="50000" className="flex-1 bg-transparent py-2 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={lbl()}>Start Date</label><input type="date" value={form.dateDetected} onChange={e => setF("dateDetected", e.target.value)} className={inp()} /></div>
                      <div><label className={lbl()}>Due Date</label><input type="date" value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} className={inp()} /></div>
                    </div>
                  </>
                )}

                {form.entryType === "payment" && (
                  <>
                    <div>
                      <label className={lbl()}>Amount Received *</label>
                      <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                        <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm select-none">₹</span>
                        <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setF("amount", e.target.value)} placeholder="25000" className="flex-1 bg-transparent py-2 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={lbl()}>Method</label>
                        <select value={form.paymentMethod} onChange={e => setF("paymentMethod", e.target.value)} className={inp("bg-gray-50")}>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                      <div><label className={lbl()}>Date</label><input type="date" value={form.dateDetected} onChange={e => setF("dateDetected", e.target.value)} className={inp()} /></div>
                    </div>
                    <div><label className={lbl()}>Brand / From</label><input value={form.brandName} onChange={e => setF("brandName", e.target.value)} className={inp()} placeholder="Who paid you?" /></div>
                  </>
                )}

                {form.entryType === "expense" && (
                  <>
                    <div>
                      <label className={lbl()}>What did you spend on? *</label>
                      <input value={form.description} onChange={e => setF("description", e.target.value)} className={inp()} placeholder="e.g. Camera operator fee" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={lbl()}>Amount *</label>
                        <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                          <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm select-none">₹</span>
                          <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setF("amount", e.target.value)} placeholder="5000" className="flex-1 bg-transparent py-2 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                        </div>
                      </div>
                      <div>
                        <label className={lbl()}>Category</label>
                        <select value={form.category} onChange={e => setF("category", e.target.value)} className={inp("bg-gray-50")}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                    </div>
                    <div><label className={lbl()}>Date</label><input type="date" value={form.dateDetected} onChange={e => setF("dateDetected", e.target.value)} className={inp()} /></div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CSV PREVIEW */}
          {stage === "csv-preview" && csvData && (
            <div className="p-6 space-y-4">
              <div className="bg-[#F0FDF4] border border-[#22C55E]/20 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-[#15803D]">{csvData.totalRows} rows detected</p>
                <p className="text-xs text-[#16A34A]/70 mt-0.5">Showing first {Math.min(5, csvData.rows.length)} rows</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                    {csvData.headers.map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-[#F8FAFC]">
                    {csvData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>{csvData.headers.map(h => <td key={h} className="px-3 py-2 text-[#374151] whitespace-nowrap max-w-[120px] truncate">{row[h]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className={lbl()}>Import as</label>
                <div className="flex gap-2">
                  {(["deals", "payments"] as const).map(t => (
                    <button key={t} onClick={() => setCsvImportType(t)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${csvImportType === t ? "bg-[#22C55E] text-white border-[#22C55E]" : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#22C55E]/30"}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setStage("csv-map")} className="w-full flex items-center justify-center gap-2 bg-[#0F172A] text-white rounded-xl py-2.5 text-sm font-bold">
                Map columns <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* CSV MAP */}
          {stage === "csv-map" && csvData && (
            <div className="p-6 space-y-4">
              <p className="text-xs text-[#9CA3AF]">Match your CSV columns to Kitna fields. Leave empty to skip.</p>
              {(csvImportType === "deals"
                ? [["brandName", "Brand Name"], ["campaignName", "Campaign"], ["amount", "Amount"], ["currency", "Currency"], ["incomeType", "Income Type"], ["startDate", "Start Date"], ["dueDate", "Due Date"]]
                : [["amount", "Amount"], ["currency", "Currency"], ["date", "Date"], ["paymentMethod", "Method"], ["notes", "Notes"]]
              ).map(([field, label]) => (
                <div key={field} className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-[#374151] w-28 shrink-0">{label}</p>
                  <select value={csvMapping[field] ?? ""} onChange={e => setCsvMapping(m => ({ ...m, [field]: e.target.value }))} className={inp("flex-1 bg-gray-50")}>
                    <option value="">— skip —</option>
                    {csvData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* CSV SUCCESS */}
          {stage === "csv-success" && csvSuccess && (
            <div className="p-6 flex flex-col items-center py-12">
              <div className="w-14 h-14 bg-[#F0FDF4] rounded-2xl flex items-center justify-center mb-5">
                <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
              </div>
              <p className="text-[#111827] font-bold text-lg">{csvSuccess.imported} entries imported</p>
              {csvSuccess.errors.length > 0 && <p className="text-amber-600 text-sm mt-1">{csvSuccess.errors.length} rows had errors</p>}
              <button onClick={onClose} className="mt-6 bg-[#22C55E] text-white px-8 py-2.5 rounded-xl text-sm font-bold">Done</button>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {(stage === "review") && (
          <div className="px-6 pb-6 pt-4 border-t border-[#F1F5F9] flex gap-3 shrink-0">
            <button onClick={handleDiscard} className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] text-[#9CA3AF] rounded-xl py-2.5 text-sm font-semibold hover:text-[#6B7280] hover:bg-gray-100 transition-colors">
              Discard
            </button>
            <button
              onClick={handleCreateEntry}
              disabled={saving}
              className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Create entry"}
            </button>
          </div>
        )}

        {stage === "csv-map" && (
          <div className="px-6 pb-6 pt-4 border-t border-[#F1F5F9] flex gap-3 shrink-0">
            <button onClick={() => setStage("csv-preview")} className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] text-[#6B7280] rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100">Back</button>
            <button onClick={handleCsvImport} disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : `Import ${csvData?.rows.length ?? 0} rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
