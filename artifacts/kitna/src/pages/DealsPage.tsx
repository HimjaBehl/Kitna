import { useState } from "react";
import {
  useGetDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useCreatePayment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, incomeTypeLabel, paymentMethodLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { QUERY_KEYS, DASHBOARD_KEYS } from "@/lib/queryKeys";
import { Plus, Pencil, Trash2, X, Search, CreditCard, Briefcase, CalendarDays, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const INCOME_TYPES = ["brand_collab", "ugc", "affiliate", "platform_payout", "retainer", "subscription", "barter", "other"];
// Note: "active" is not a computed status — API computes: pending_payment, partially_paid, paid, overdue, draft, cancelled
const STATUSES = ["pending_payment", "partially_paid", "paid", "overdue", "draft", "cancelled"];
const PAYMENT_METHODS = ["bank_transfer", "upi", "platform_payout", "gateway", "cash", "other"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending_payment: "Pending",
  partially_paid: "Partial", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
};

interface DealFormData {
  brandName: string; campaignName: string; incomeType: string;
  amountAgreed: string; currency: string; isBarter: boolean;
  barterEstimatedValue: string; barterDescription: string;
  startDate: string; dueDate: string; notes: string;
  invoiceNumber: string; invoiceDate: string; invoiceStatus: string; invoiceAmount: string;
  managerCutType: string; managerCutValue: string;
  agencyCutType: string; agencyCutValue: string;
  gstApplicable: boolean; taxableValue: string;
  tdsApplicable: boolean; tdsAmount: string;
}
const DEFAULT_FORM: DealFormData = {
  brandName: "", campaignName: "", incomeType: "brand_collab",
  amountAgreed: "", currency: "INR", isBarter: false,
  barterEstimatedValue: "", barterDescription: "",
  startDate: "", dueDate: "", notes: "",
  invoiceNumber: "", invoiceDate: "", invoiceStatus: "not_raised", invoiceAmount: "",
  managerCutType: "", managerCutValue: "",
  agencyCutType: "", agencyCutValue: "",
  gstApplicable: false, taxableValue: "",
  tdsApplicable: false, tdsAmount: "",
};

function inp(extra = "") {
  return `w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/20 placeholder:text-[#9CA3AF] transition-colors ${extra}`;
}
function lbl() { return "text-xs font-semibold text-[#6B7280] uppercase tracking-wide block mb-1.5"; }

function SectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] hover:bg-gray-100 transition-colors">
      <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{label}</span>
      <span className="text-[#9CA3AF] text-xs">{open ? "▲" : "▼"}</span>
    </button>
  );
}

/* ── Deal form modal ─────────────────────────────────────── */
function DealModal({ deal, onClose }: { deal?: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const isEdit = !!deal;

  const [form, setForm] = useState<DealFormData>(() => deal ? {
    brandName: (deal.brandName as string) ?? "",
    campaignName: (deal.campaignName as string) ?? "",
    incomeType: (deal.incomeType as string) ?? "brand_collab",
    amountAgreed: (deal.amountAgreed as string) ?? "",
    currency: (deal.currency as string) ?? "INR",
    isBarter: (deal.isBarter as boolean) ?? false,
    barterEstimatedValue: (deal.barterEstimatedValue as string) ?? "",
    barterDescription: (deal.barterDescription as string) ?? "",
    startDate: deal.startDate ? new Date(deal.startDate as string).toISOString().split("T")[0] : "",
    dueDate: deal.dueDate ? new Date(deal.dueDate as string).toISOString().split("T")[0] : "",
    notes: (deal.notes as string) ?? "",
    invoiceNumber: (deal.invoiceNumber as string) ?? "",
    invoiceDate: deal.invoiceDate ? new Date(deal.invoiceDate as string).toISOString().split("T")[0] : "",
    invoiceStatus: (deal.invoiceStatus as string) ?? "not_raised",
    invoiceAmount: (deal.invoiceAmount as string) ?? "",
    managerCutType: (deal.managerCutType as string) ?? "",
    managerCutValue: (deal.managerCutValue as string) ?? "",
    agencyCutType: (deal.agencyCutType as string) ?? "",
    agencyCutValue: (deal.agencyCutValue as string) ?? "",
    gstApplicable: (deal.gstApplicable as boolean) ?? false,
    taxableValue: (deal.taxableValue as string) ?? "",
    tdsApplicable: (deal.tdsApplicable as boolean) ?? false,
    tdsAmount: (deal.tdsAmount as string) ?? "",
  } : DEFAULT_FORM);

  const [showInvoice, setShowInvoice] = useState(!!deal?.invoiceNumber || deal?.invoiceStatus !== "not_raised");
  const [showCuts, setShowCuts] = useState(!!(deal?.managerCutValue || deal?.agencyCutValue));
  const [showTax, setShowTax] = useState(!!(deal?.gstApplicable || deal?.tdsApplicable));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof DealFormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const payload = {
        brandName: form.brandName, campaignName: form.campaignName, incomeType: form.incomeType,
        amountAgreed: form.amountAgreed, currency: form.currency, isBarter: form.isBarter,
        barterEstimatedValue: form.barterEstimatedValue || null,
        barterDescription: form.barterDescription || null,
        startDate: form.startDate || null, dueDate: form.dueDate || null, notes: form.notes || null,
        invoiceNumber: form.invoiceNumber || null,
        invoiceDate: form.invoiceDate || null,
        invoiceStatus: form.invoiceStatus || "not_raised",
        invoiceAmount: form.invoiceAmount || null,
        managerCutType: form.managerCutType || null,
        managerCutValue: form.managerCutValue || null,
        agencyCutType: form.agencyCutType || null,
        agencyCutValue: form.agencyCutValue || null,
        gstApplicable: form.gstApplicable,
        taxableValue: form.taxableValue || null,
        tdsApplicable: form.tdsApplicable,
        tdsAmount: form.tdsAmount || null,
      };
      if (isEdit) { await updateDeal.mutateAsync({ id: deal.id as number, data: payload }); toast.success("Deal updated"); }
      else { await createDeal.mutateAsync({ data: payload }); toast.success("Deal added"); }
      await invalidateAll(); onClose();
    } catch { setError("Failed to save deal"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <h2 className="font-bold text-[#111827] text-lg">{isEdit ? "Edit Deal" : "Add New Deal"}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <p className="text-[#EF4444] text-sm">{error}</p>}
          <div>
            <label className={lbl()}>Brand / Client *</label>
            <input value={form.brandName} onChange={e => set("brandName", e.target.value)} required className={inp()} placeholder="e.g. Boat Lifestyle" autoFocus />
          </div>
          <div>
            <label className={lbl()}>What's the deliverable? *</label>
            <input value={form.campaignName} onChange={e => set("campaignName", e.target.value)} required className={inp()} placeholder="e.g. 2 Reels + 1 YouTube video" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl()}>Deal Amount *</label>
              <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                <input type="number" step="0.01" min="0" value={form.amountAgreed} onChange={e => set("amountAgreed", e.target.value)} required placeholder="50000" className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
              </div>
            </div>
            <div>
              <label className={lbl()}>Type</label>
              <select value={form.incomeType} onChange={e => set("incomeType", e.target.value)} className={inp("bg-gray-50")}>
                {INCOME_TYPES.map(t => <option key={t} value={t}>{incomeTypeLabel(t)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl()}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className={inp()} />
            </div>
            <div>
              <label className={lbl()}>Payment Due</label>
              <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} className={inp()} />
            </div>
          </div>
          <div className="flex items-center gap-3 py-1">
            <input type="checkbox" id="isBarter" checked={form.isBarter} onChange={e => set("isBarter", e.target.checked)} className="rounded accent-[#22C55E]" />
            <label htmlFor="isBarter" className="text-sm text-[#374151]">This is a barter deal (no cash payment)</label>
          </div>
          {form.isBarter && (
            <div className="space-y-3">
              <div>
                <label className={lbl()}>Estimated Barter Value</label>
                <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                  <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                  <input type="number" step="0.01" min="0" value={form.barterEstimatedValue} onChange={e => set("barterEstimatedValue", e.target.value)} placeholder="15000" className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                </div>
              </div>
              <div>
                <label className={lbl()}>What did you receive?</label>
                <input value={form.barterDescription} onChange={e => set("barterDescription", e.target.value)} className={inp()} placeholder="e.g. iPhone 15 Pro, 1 year subscription" />
              </div>
            </div>
          )}
          <div>
            <label className={lbl()}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className={inp("resize-none")} placeholder="Deliverables, terms, or anything to remember" />
          </div>

          {/* ── Invoice details ──────────────────────────── */}
          <SectionToggle label="Invoice details" open={showInvoice} onToggle={() => setShowInvoice(p => !p)} />
          {showInvoice && (
            <div className="space-y-4 bg-[#FAFAFA] rounded-xl p-4 border border-[#E5E7EB]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl()}>Invoice Number</label>
                  <input value={form.invoiceNumber} onChange={e => set("invoiceNumber", e.target.value)} className={inp()} placeholder="INV-001" />
                </div>
                <div>
                  <label className={lbl()}>Invoice Status</label>
                  <select value={form.invoiceStatus} onChange={e => set("invoiceStatus", e.target.value)} className={inp("bg-gray-50")}>
                    <option value="not_raised">Not raised yet</option>
                    <option value="raised">Raised</option>
                    <option value="sent">Sent to brand</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl()}>Invoice Date</label>
                  <input type="date" value={form.invoiceDate} onChange={e => set("invoiceDate", e.target.value)} className={inp()} />
                </div>
                <div>
                  <label className={lbl()}>Invoice Amount</label>
                  <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                    <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                    <input type="number" step="0.01" min="0" value={form.invoiceAmount} onChange={e => set("invoiceAmount", e.target.value)} placeholder="Same as deal" className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Manager / Agency fees ────────────────────── */}
          <SectionToggle label="Manager / Agency fees" open={showCuts} onToggle={() => setShowCuts(p => !p)} />
          {showCuts && (
            <div className="space-y-4 bg-[#FAFAFA] rounded-xl p-4 border border-[#E5E7EB]">
              <p className="text-xs text-[#9CA3AF]">These cuts are deducted from your take-home. Kitna uses them in profitability calculations.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl()}>Manager cut type</label>
                  <select value={form.managerCutType} onChange={e => set("managerCutType", e.target.value)} className={inp("bg-gray-50")}>
                    <option value="">No manager cut</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                {form.managerCutType && (
                  <div>
                    <label className={lbl()}>{form.managerCutType === "percentage" ? "Manager %" : "Manager fee"}</label>
                    <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                      <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">{form.managerCutType === "percentage" ? "%" : "₹"}</span>
                      <input type="number" step="0.01" min="0" value={form.managerCutValue} onChange={e => set("managerCutValue", e.target.value)} placeholder={form.managerCutType === "percentage" ? "20" : "10000"} className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl()}>Agency cut type</label>
                  <select value={form.agencyCutType} onChange={e => set("agencyCutType", e.target.value)} className={inp("bg-gray-50")}>
                    <option value="">No agency cut</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                {form.agencyCutType && (
                  <div>
                    <label className={lbl()}>{form.agencyCutType === "percentage" ? "Agency %" : "Agency fee"}</label>
                    <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                      <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">{form.agencyCutType === "percentage" ? "%" : "₹"}</span>
                      <input type="number" step="0.01" min="0" value={form.agencyCutValue} onChange={e => set("agencyCutValue", e.target.value)} placeholder={form.agencyCutType === "percentage" ? "10" : "5000"} className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── GST / TDS ────────────────────────────────── */}
          <SectionToggle label="GST & TDS" open={showTax} onToggle={() => setShowTax(p => !p)} />
          {showTax && (
            <div className="space-y-4 bg-[#FAFAFA] rounded-xl p-4 border border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="gstApplicable" checked={form.gstApplicable} onChange={e => set("gstApplicable", e.target.checked)} className="rounded accent-[#22C55E]" />
                <label htmlFor="gstApplicable" className="text-sm text-[#374151]">GST applicable on this deal</label>
              </div>
              {form.gstApplicable && (
                <div>
                  <label className={lbl()}>Taxable value <span className="normal-case text-[#D1D5DB] font-normal">(if different from deal amount)</span></label>
                  <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                    <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                    <input type="number" step="0.01" min="0" value={form.taxableValue} onChange={e => set("taxableValue", e.target.value)} placeholder={form.amountAgreed || "Same as deal amount"} className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="tdsApplicable" checked={form.tdsApplicable} onChange={e => set("tdsApplicable", e.target.checked)} className="rounded accent-[#22C55E]" />
                <label htmlFor="tdsApplicable" className="text-sm text-[#374151]">TDS was deducted on this deal</label>
              </div>
              {form.tdsApplicable && (
                <div>
                  <label className={lbl()}>TDS amount deducted</label>
                  <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                    <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                    <input type="number" step="0.01" min="0" value={form.tdsAmount} onChange={e => set("tdsAmount", e.target.value)} placeholder="e.g. 5000" className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] text-[#6B7280] rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors">{loading ? "Saving…" : isEdit ? "Save Changes" : "Add Deal"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Quick payment modal ─────────────────────────────────── */
function QuickPaymentModal({ deal, onClose }: { deal: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const createPayment = useCreatePayment();
  const agreedNum = parseFloat(deal.amountAgreed as string ?? "0");
  const receivedNum = parseFloat(deal.totalReceived as string ?? "0");
  const remaining = Math.max(agreedNum - receivedNum, 0);

  const [form, setForm] = useState({
    amountReceived: remaining > 0 ? remaining.toFixed(0) : "",
    currency: (deal.currency as string) ?? "INR",
    paymentMethod: "bank_transfer",
    receivedDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await createPayment.mutateAsync({ data: { dealId: deal.id as number, amountReceived: form.amountReceived, currency: form.currency, paymentMethod: form.paymentMethod, receivedDate: form.receivedDate, notes: form.notes || null } });
      toast.success(`Payment of ${formatCurrency(form.amountReceived, form.currency)} recorded`);
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.payments });
      for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
      onClose();
    } catch { setError("Failed to record payment"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <div>
            <h2 className="font-bold text-[#111827] text-base">Record Payment</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{deal.brandName as string}</p>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-[#EF4444] text-sm">{error}</p>}
          <div className="bg-[#F8FAFC] rounded-xl px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Agreed</span>
              <span className="font-semibold text-[#111827]">{formatCurrency(deal.amountAgreed as string, deal.currency as string)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Received so far</span>
              <span className="font-semibold text-[#15803D]">{formatCurrency(deal.totalReceived as string, deal.currency as string)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E5E7EB] pt-1.5">
              <span className="text-[#374151] font-medium">Still to come</span>
              <span className="font-bold text-[#F59E0B]">{formatCurrency(remaining, deal.currency as string)}</span>
            </div>
          </div>
          <div>
            <label className={lbl()}>Amount *</label>
            <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20">
              <span className="pl-3.5 pr-1 text-[#9CA3AF] text-sm select-none">₹</span>
              <input type="number" step="0.01" min="0.01" value={form.amountReceived} onChange={e => set("amountReceived", e.target.value)} required autoFocus className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-[#111827] outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl()}>Method</label>
              <select value={form.paymentMethod} onChange={e => set("paymentMethod", e.target.value)} className={inp("bg-gray-50")}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl()}>Date *</label>
              <input type="date" value={form.receivedDate} onChange={e => set("receivedDate", e.target.value)} required className={inp()} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] text-[#6B7280] rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">{loading ? "Saving…" : "Record"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Income type pill ────────────────────────────────────── */
function TypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F8FAFC] text-[#6B7280] border border-[#E5E7EB] uppercase tracking-wide whitespace-nowrap">
      {incomeTypeLabel(type)}
    </span>
  );
}

/* ── Next-action hint for a deal ─────────────────────────── */
function nextActionHint(status: string, dueDate: string | null | undefined, received: number, agreed: number): { label: string; color: string } | null {
  const now = new Date();
  if (status === "paid") return null;
  if (status === "cancelled") return null;
  if (status === "overdue") return { label: "Payment overdue — follow up needed", color: "text-[#DC2626]" };

  if (dueDate) {
    const due = new Date(dueDate);
    const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { label: "Payment due today", color: "text-[#DC2626]" };
    if (diffDays === 1) return { label: "Payment due tomorrow", color: "text-[#D97706]" };
    if (diffDays > 0 && diffDays <= 5) return { label: `Due in ${diffDays} days`, color: "text-[#D97706]" };
    if (diffDays > 5) return { label: `Due ${formatDate(dueDate)}`, color: "text-[#9CA3AF]" };
  }

  if (status === "partially_paid") {
    const pct = agreed > 0 ? received / agreed : 0;
    if (pct >= 0.5) return { label: "Final payment pending", color: "text-[#D97706]" };
    return { label: "Partial — more payments expected", color: "text-[#D97706]" };
  }
  if (status === "pending_payment") return { label: "Awaiting first payment", color: "text-[#9CA3AF]" };
  return null;
}

/* ── Individual deal row ─────────────────────────────────── */
function DealRow({ deal, onEdit, onDelete, onPay }: {
  deal: Record<string, unknown>;
  onEdit: () => void; onDelete: () => void; onPay: () => void;
}) {
  const agreed = parseFloat(deal.amountAgreed as string ?? "0");
  const received = parseFloat(deal.totalReceived as string ?? "0");
  const pending = Math.max(agreed - received, 0);
  const pct = agreed > 0 ? Math.min((received / agreed) * 100, 100) : 0;
  const status = deal.status as string;
  const isOverdue = status === "overdue";
  const isPaid = status === "paid";
  const cur = deal.currency as string;
  const hint = nextActionHint(status, deal.dueDate as string | null, received, agreed);

  return (
    <div className={`bg-white rounded-xl border px-5 py-4 transition-shadow hover:shadow-sm ${isOverdue ? "border-l-2 border-l-[#EF4444] border-[#FECACA]" : "border-[#E5E7EB]"}`}>
      {/* Row 1: brand + badges + amount */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-[#111827] text-sm leading-tight">{deal.brandName as string}</p>
            <StatusBadge status={status} />
            {deal.isBarter && <StatusBadge status="barter" />}
            <TypePill type={deal.incomeType as string} />
          </div>
          <p className="text-[#6B7280] text-xs mt-0.5 leading-snug truncate">{deal.campaignName as string}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-[#111827]">{formatCurrency(agreed, cur)}</p>
          {deal.isBarter && deal.barterEstimatedValue && (
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">Barter value {formatCurrency(deal.barterEstimatedValue as string, cur)}</p>
          )}
        </div>
      </div>

      {/* Row 2: progress */}
      {!deal.isBarter && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#6B7280]">
              Received <span className="font-semibold text-[#111827]">{formatCurrency(received, cur)}</span>
              <span className="text-[#D1D5DB] mx-1">of</span>
              <span className="font-semibold text-[#111827]">{formatCurrency(agreed, cur)}</span>
            </span>
            {pending > 0 && !isPaid ? (
              <span className={`text-xs font-semibold ${isOverdue ? "text-[#EF4444]" : "text-[#F59E0B]"}`}>
                {formatCurrency(pending, cur)} still to come
              </span>
            ) : isPaid ? (
              <span className="text-xs font-semibold text-[#15803D]">Fully received ✓</span>
            ) : null}
          </div>
          <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isPaid ? "bg-[#22C55E]" : pct > 0 ? "bg-[#F59E0B]" : "bg-[#E5E7EB]"}`}
              style={{ width: `${Math.max(pct, 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Row 3: next action hint + actions */}
      <div className="flex items-center justify-between mt-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {hint ? (
            <span className={`text-[11px] font-medium flex items-center gap-1 ${hint.color}`}>
              {isOverdue && <AlertTriangle className="w-3 h-3 shrink-0" />}
              {hint.label}
            </span>
          ) : deal.startDate ? (
            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Started {formatDate(deal.startDate as string)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isPaid && !deal.isBarter && status !== "cancelled" && (
            <button
              onClick={onPay}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[#22C55E] bg-[#F0FDF4] hover:bg-[#DCFCE7] rounded-lg text-[11px] font-semibold transition-colors"
              title="Add payment"
            >
              <CreditCard className="w-3 h-3" />
              Pay
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F8FAFC] rounded-lg transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stat pill ───────────────────────────────────────────── */
function StatPill({ label, value, color = "neutral" }: { label: string; value: string | number; color?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  const colors = {
    green: "text-[#15803D] bg-[#F0FDF4] border-[#22C55E]/20",
    amber: "text-[#B45309] bg-amber-50 border-amber-200",
    red: "text-[#DC2626] bg-red-50 border-red-100",
    blue: "text-[#1D4ED8] bg-blue-50 border-blue-100",
    neutral: "text-[#374151] bg-[#F8FAFC] border-[#E5E7EB]",
  }[color];
  return (
    <div className={`rounded-xl border px-4 py-2.5 ${colors}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export function DealsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editDeal, setEditDeal] = useState<Record<string, unknown> | null>(null);
  const [paymentDeal, setPaymentDeal] = useState<Record<string, unknown> | null>(null);

  const params = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { income_type: typeFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data: deals, isLoading } = useGetDeals(params, { query: { queryKey: [...QUERY_KEYS.deals, params] } });
  const deleteDeal = useDeleteDeal();

  const handleDelete = async (id: number, brandName: string) => {
    if (!confirm(`Delete deal with ${brandName}? This cannot be undone.`)) return;
    await deleteDeal.mutateAsync({ id });
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
    toast.success("Deal deleted");
  };

  const dealsList = deals ?? [];
  const activeDeals = dealsList.filter(d => ["pending_payment", "partially_paid"].includes(d.status ?? "")).length;
  const overdueDeals = dealsList.filter(d => d.status === "overdue").length;
  const pendingAmount = dealsList.reduce((s, d) => {
    const a = parseFloat(d.amountAgreed ?? "0");
    const r = parseFloat(d.totalReceived ?? "0");
    return s + Math.max(a - r, 0);
  }, 0);
  const totalBooked = dealsList.reduce((s, d) => s + parseFloat(d.amountAgreed ?? "0"), 0);
  const totalReceived = dealsList.reduce((s, d) => s + parseFloat(d.totalReceived ?? "0"), 0);

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Deals</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">All your expected money</p>
        </div>
        <button
          onClick={() => { setEditDeal(null); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-green-200"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Add Deal
        </button>
      </div>

      {/* Summary strip */}
      {dealsList.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-5">
          <StatPill label="Active" value={activeDeals} color="blue" />
          <StatPill label="Overdue" value={overdueDeals} color={overdueDeals > 0 ? "red" : "neutral"} />
          <StatPill label="Still to come" value={formatCurrency(pendingAmount, "INR")} color="amber" />
          <StatPill label="Total booked" value={formatCurrency(totalBooked, "INR")} color="neutral" />
          <StatPill label="Total received" value={formatCurrency(totalReceived, "INR")} color="green" />
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search brand or campaign…"
            className="pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white rounded-xl text-sm focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/20 w-56 text-[#111827] placeholder:text-[#9CA3AF]"
          />
        </div>
        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === "" ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#9CA3AF]"}`}
          >
            All
          </button>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === s ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#9CA3AF]"}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Type filter */}
        <select
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="ml-auto border border-[#E5E7EB] bg-white rounded-xl px-3 py-2 text-xs text-[#374151] focus:outline-none focus:border-[#22C55E] cursor-pointer"
        >
          <option value="">All types</option>
          {INCOME_TYPES.map(t => <option key={t} value={t}>{incomeTypeLabel(t)}</option>)}
        </select>
      </div>

      {/* Deal list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-4 bg-gray-100 rounded w-20" />
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full" />
              <div className="h-3 bg-gray-100 rounded w-48" />
            </div>
          ))}
        </div>
      ) : dealsList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] py-20 text-center">
          <Briefcase className="w-10 h-10 text-[#E5E7EB] mx-auto mb-3" />
          <p className="text-[#374151] font-semibold">No deals yet</p>
          <p className="text-[#9CA3AF] text-sm mt-1">Add your first deal to start tracking your work</p>
          <button onClick={() => setShowModal(true)} className="mt-5 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
            + Add Deal
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dealsList.map(deal => (
            <DealRow
              key={deal.id}
              deal={deal as unknown as Record<string, unknown>}
              onEdit={() => { setEditDeal(deal as unknown as Record<string, unknown>); setShowModal(true); }}
              onDelete={() => handleDelete(deal.id, deal.brandName)}
              onPay={() => setPaymentDeal(deal as unknown as Record<string, unknown>)}
            />
          ))}
        </div>
      )}

      {showModal && <DealModal deal={editDeal ?? undefined} onClose={() => { setShowModal(false); setEditDeal(null); }} />}
      {paymentDeal && <QuickPaymentModal deal={paymentDeal} onClose={() => setPaymentDeal(null)} />}
    </div>
  );
}
