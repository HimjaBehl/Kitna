import { useState } from "react";
import { useGetPayments, useGetDeals, useCreatePayment, useUpdatePayment, useDeletePayment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, paymentMethodLabel } from "@/lib/format";
import { QUERY_KEYS, DASHBOARD_KEYS } from "@/lib/queryKeys";
import { Plus, Pencil, Trash2, X, CreditCard, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_METHODS = ["bank_transfer", "upi", "platform_payout", "gateway", "cash", "other"];

const METHOD_ICONS: Record<string, string> = {
  bank_transfer: "Bank",
  upi: "UPI",
  platform_payout: "Platform",
  gateway: "Gateway",
  cash: "Cash",
  other: "Other",
};

function inp(extra = "") {
  return `w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/20 placeholder:text-[#9CA3AF] transition-colors ${extra}`;
}
function lbl() { return "text-xs font-semibold text-[#6B7280] uppercase tracking-wide block mb-1.5"; }

/* ── Payment form modal ──────────────────────────────────── */
function PaymentModal({ payment, onClose }: { payment?: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const { data: deals } = useGetDeals({}, { query: { queryKey: QUERY_KEYS.deals } });
  const isEdit = !!payment;

  const [form, setForm] = useState(() => payment ? {
    dealId: payment.dealId != null ? String(payment.dealId) : "",
    amountReceived: (payment.amountReceived as string) ?? "",
    currency: (payment.currency as string) ?? "INR",
    paymentMethod: (payment.paymentMethod as string) ?? "bank_transfer",
    receivedDate: payment.receivedDate ? new Date(payment.receivedDate as string).toISOString().split("T")[0] : "",
    notes: (payment.notes as string) ?? "",
    tdsApplicable: (payment.tdsApplicable as boolean) ?? false,
    tdsAmount: (payment.tdsAmount as string) ?? "",
  } : {
    dealId: "", amountReceived: "", currency: "INR",
    paymentMethod: "bank_transfer",
    receivedDate: new Date().toISOString().split("T")[0],
    notes: "",
    tdsApplicable: false,
    tdsAmount: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const payload = {
        dealId: form.dealId ? parseInt(form.dealId) : null,
        amountReceived: form.amountReceived, currency: form.currency,
        paymentMethod: form.paymentMethod, receivedDate: form.receivedDate,
        notes: form.notes || null,
        tdsApplicable: form.tdsApplicable,
        tdsAmount: form.tdsAmount || null,
      };
      if (isEdit) { await updatePayment.mutateAsync({ id: payment.id as number, data: payload }); toast.success("Payment updated"); }
      else { await createPayment.mutateAsync({ data: payload }); toast.success("Payment recorded"); }
      await invalidateAll(); onClose();
    } catch { setError("Failed to save payment"); } finally { setLoading(false); }
  };

  const linkedDeal = (deals ?? []).find(d => String(d.id) === form.dealId);
  const agreed = linkedDeal ? parseFloat(linkedDeal.amountAgreed) : 0;
  const prevReceived = linkedDeal ? parseFloat((linkedDeal as any).totalReceived ?? "0") : 0;
  const enteredAmount = parseFloat(form.amountReceived) || 0;
  const wouldComplete = linkedDeal && enteredAmount >= (agreed - prevReceived);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <h2 className="font-bold text-[#111827] text-lg">{isEdit ? "Edit Payment" : "Record Payment"}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-[#EF4444] text-sm">{error}</p>}
          <div>
            <label className={lbl()}>Which deal? <span className="text-[#D1D5DB] normal-case font-normal">(optional)</span></label>
            <select value={form.dealId} onChange={e => set("dealId", e.target.value)} className={inp() + " bg-gray-50"}>
              <option value="">No deal linked</option>
              {(deals ?? []).map(d => <option key={d.id} value={String(d.id)}>{d.brandName} — {d.campaignName}</option>)}
            </select>
            {linkedDeal && (
              <div className="mt-2 bg-[#F8FAFC] rounded-xl px-4 py-2.5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Deal total</span>
                  <span className="font-semibold text-[#111827]">{formatCurrency(linkedDeal.amountAgreed, linkedDeal.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Received so far</span>
                  <span className="font-semibold text-[#15803D]">{formatCurrency(prevReceived, linkedDeal.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E5E7EB] pt-1">
                  <span className="text-[#374151] font-medium">Still pending</span>
                  <span className="font-bold text-[#F59E0B]">{formatCurrency(Math.max(agreed - prevReceived, 0), linkedDeal.currency)}</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className={lbl()}>Amount Received *</label>
            <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
              <span className="pl-4 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
              <input type="number" step="0.01" min="0.01" value={form.amountReceived} onChange={e => set("amountReceived", e.target.value)} required placeholder="25000" autoFocus className="flex-1 bg-transparent py-2.5 pr-4 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
            </div>
            {wouldComplete && (
              <p className="text-[11px] text-[#15803D] font-semibold mt-1.5 flex items-center gap-1">
                ✓ This will mark the deal as fully paid
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl()}>Method</label>
              <select value={form.paymentMethod} onChange={e => set("paymentMethod", e.target.value)} className={inp() + " bg-gray-50"}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl()}>Date *</label>
              <input type="date" value={form.receivedDate} onChange={e => set("receivedDate", e.target.value)} required className={inp()} />
            </div>
          </div>
          <div>
            <label className={lbl()}>Note</label>
            <input value={form.notes} onChange={e => set("notes", e.target.value)} className={inp()} placeholder="e.g. Advance — 50%" />
          </div>
          <div className="flex items-center gap-3 py-1">
            <input type="checkbox" id="tdsApplicable" checked={form.tdsApplicable} onChange={e => set("tdsApplicable", e.target.checked)} className="rounded accent-[#22C55E]" />
            <label htmlFor="tdsApplicable" className="text-sm text-[#374151]">TDS was deducted from this payment</label>
          </div>
          {form.tdsApplicable && (
            <div>
              <label className={lbl()}>TDS amount deducted</label>
              <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                <span className="pl-4 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                <input type="number" step="0.01" min="0" value={form.tdsAmount} onChange={e => set("tdsAmount", e.target.value)} placeholder="e.g. 2000" className="flex-1 bg-transparent py-2.5 pr-4 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] text-[#6B7280] rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Method pill ─────────────────────────────────────────── */
function MethodPill({ method }: { method: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F8FAFC] text-[#6B7280] border border-[#E5E7EB] uppercase tracking-wide">
      {METHOD_ICONS[method] ?? method}
    </span>
  );
}

/* ── Payment context badge (Partial / Final / Advance) ───── */
function PaymentContextBadge({ label, color }: { label: string; color: "green" | "amber" | "blue" | "neutral" }) {
  const styles = {
    green: "bg-[#F0FDF4] text-[#15803D] border-[#22C55E]/20",
    amber: "bg-amber-50 text-[#B45309] border-amber-200",
    blue: "bg-blue-50 text-[#1D4ED8] border-blue-100",
    neutral: "bg-[#F8FAFC] text-[#6B7280] border-[#E5E7EB]",
  }[color];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${styles}`}>
      {label}
    </span>
  );
}

/* ── Payment row card ────────────────────────────────────── */
function PaymentRow({ payment, dealMap, onEdit, onDelete }: {
  payment: Record<string, unknown>;
  dealMap: Map<number, Record<string, unknown>>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const amount = parseFloat(payment.amountReceived as string ?? "0");
  const cur = (payment.currency as string) ?? "INR";
  const hasDeal = !!payment.dealBrandName;
  const dealId = payment.dealId as number | null;

  const deal = dealId ? dealMap.get(dealId) : null;
  const dealAgreed = deal ? parseFloat(deal.amountAgreed as string ?? "0") : 0;
  const dealReceived = deal ? parseFloat(deal.totalReceived as string ?? "0") : 0;
  const dealStatus = deal ? (deal.status as string) : null;
  const remaining = deal ? Math.max(dealAgreed - dealReceived, 0) : 0;

  let contextBadge: { label: string; color: "green" | "amber" | "blue" | "neutral" } | null = null;
  if (deal) {
    if (dealStatus === "paid") contextBadge = { label: "Deal completed", color: "green" };
    else if (dealReceived > 0 && amount <= dealAgreed * 0.35) contextBadge = { label: "Advance", color: "blue" };
    else if (remaining > 0) contextBadge = { label: "Partial", color: "amber" };
    else contextBadge = { label: "Final", color: "green" };
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* Amount — left accent */}
        <div className="shrink-0 text-right min-w-[88px]">
          <p className="text-base font-bold text-[#15803D] leading-tight">+{formatCurrency(amount, cur)}</p>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">{formatDate(payment.receivedDate as string)}</p>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#F1F5F9] self-stretch shrink-0" />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {hasDeal ? (
                <>
                  <p className="text-sm font-bold text-[#111827] truncate">{payment.dealBrandName as string}</p>
                  <p className="text-xs text-[#9CA3AF] truncate mt-0.5 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    {payment.dealCampaignName as string}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#9CA3AF] italic">No deal linked</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEdit} className="p-1.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F8FAFC] rounded-lg transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="p-1.5 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <MethodPill method={payment.paymentMethod as string} />
            {contextBadge && <PaymentContextBadge label={contextBadge.label} color={contextBadge.color} />}
            {deal && remaining > 0 && dealStatus !== "paid" && (
              <span className="text-[11px] text-[#9CA3AF]">
                {formatCurrency(remaining, cur)} still to come
              </span>
            )}
            {payment.notes && (
              <span className="text-[11px] text-[#9CA3AF] truncate max-w-[200px]">· {payment.notes as string}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────── */
function StatCard({ label, value, sub, color = "neutral" }: {
  label: string; value: string; sub?: string; color?: "green" | "blue" | "neutral";
}) {
  const colors = {
    green: "text-[#15803D] bg-[#F0FDF4] border-[#22C55E]/20",
    blue: "text-[#1D4ED8] bg-blue-50 border-blue-100",
    neutral: "text-[#374151] bg-[#F8FAFC] border-[#E5E7EB]",
  }[color];
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export function PaymentsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editPayment, setEditPayment] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");

  const { data: payments, isLoading } = useGetPayments({}, { query: { queryKey: QUERY_KEYS.payments } });
  const { data: deals } = useGetDeals({}, { query: { queryKey: QUERY_KEYS.deals } });
  const deletePayment = useDeletePayment();

  const dealMap = new Map<number, Record<string, unknown>>(
    (deals ?? []).map(d => [d.id as number, d as unknown as Record<string, unknown>])
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this payment? This will affect deal status.")) return;
    await deletePayment.mutateAsync({ id });
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
    toast.success("Payment deleted");
  };

  const allPayments = payments ?? [];

  const filtered = search
    ? allPayments.filter(p =>
        (p.dealBrandName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.dealCampaignName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.notes ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : allPayments;

  const totalReceived = allPayments.reduce((s, p) => s + parseFloat(p.amountReceived ?? "0"), 0);
  const now = new Date();
  const thisMonth = allPayments.filter(p => {
    const d = new Date(p.receivedDate ?? "");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thisMonthTotal = thisMonth.reduce((s, p) => s + parseFloat(p.amountReceived ?? "0"), 0);
  const linkedCount = allPayments.filter(p => p.dealId != null).length;

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Payments</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Money that actually came in</p>
        </div>
        <button
          onClick={() => { setEditPayment(null); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Record Payment
        </button>
      </div>

      {/* Summary strip */}
      {allPayments.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-5">
          <StatCard label="Total received" value={formatCurrency(totalReceived, "INR")} color="green" />
          <StatCard label="This month" value={formatCurrency(thisMonthTotal, "INR")} sub={`${thisMonth.length} payment${thisMonth.length !== 1 ? "s" : ""}`} color="green" />
          <StatCard label="Linked to deals" value={String(linkedCount)} sub={`of ${allPayments.length} payments`} color="neutral" />
        </div>
      )}

      {/* Search */}
      {allPayments.length > 0 && (
        <div className="relative mb-5 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search brand or deal…"
            className="pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white rounded-xl text-sm focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/20 w-full text-[#111827] placeholder:text-[#9CA3AF]"
          />
        </div>
      )}

      {/* Payment list */}
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 animate-pulse flex gap-4">
              <div className="w-20 space-y-2">
                <div className="h-4 bg-green-100 rounded" />
                <div className="h-3 bg-gray-100 rounded" />
              </div>
              <div className="w-px bg-[#F1F5F9]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : allPayments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] py-20 text-center">
          <CreditCard className="w-10 h-10 text-[#E5E7EB] mx-auto mb-3" />
          <p className="text-[#374151] font-semibold">No payments recorded</p>
          <p className="text-[#9CA3AF] text-sm mt-1">When a brand pays you, record it here</p>
          <button onClick={() => setShowModal(true)} className="mt-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-5 py-2.5 rounded-xl text-sm">
            + Record Payment
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] py-12 text-center">
          <p className="text-[#9CA3AF] text-sm">No payments match your search</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(p => (
            <PaymentRow
              key={p.id}
              payment={p as unknown as Record<string, unknown>}
              dealMap={dealMap}
              onEdit={() => { setEditPayment(p as unknown as Record<string, unknown>); setShowModal(true); }}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {(showModal || editPayment) && (
        <PaymentModal
          payment={editPayment ?? undefined}
          onClose={() => { setShowModal(false); setEditPayment(null); }}
        />
      )}
    </div>
  );
}
