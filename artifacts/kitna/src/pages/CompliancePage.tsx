import { useGetComplianceSummary, useGetDeals, useGetPayments, useGetExpenses } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { ShieldCheck, AlertTriangle, FileText, Download, IndianRupee, Tag, Receipt, Info } from "lucide-react";

const GST_THRESHOLD = 2000000;

const INVOICE_STATUS_LABELS: Record<string, string> = {
  not_raised: "Not raised",
  raised: "Raised",
  sent: "Sent",
  paid: "Paid",
};
const INVOICE_STATUS_COLORS: Record<string, string> = {
  not_raised: "bg-gray-100 text-gray-500",
  raised: "bg-blue-50 text-blue-700",
  sent: "bg-amber-50 text-amber-700",
  paid: "bg-green-50 text-green-700",
};

/* ── Helpers ─────────────────────────────────────────────── */
function downloadCSV(filename: string, rows: (string | number | boolean | null | undefined)[][], headers: string[]) {
  const lines = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── Stat card ───────────────────────────────────────────── */
function StatCard({
  label, value, sub, icon: Icon, iconColor = "green", accentColor,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconColor?: "green" | "blue" | "purple" | "amber";
  accentColor?: string;
}) {
  const iconBg = {
    green: "bg-[#22C55E]/10", blue: "bg-[#2563EB]/10",
    purple: "bg-[#7C3AED]/10", amber: "bg-[#F59E0B]/10",
  }[iconColor];
  const iconFg = {
    green: "text-[#22C55E]", blue: "text-[#2563EB]",
    purple: "text-[#7C3AED]", amber: "text-[#F59E0B]",
  }[iconColor];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconFg}`} />
        </div>
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${accentColor ?? "text-[#111827]"}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ── Section header ──────────────────────────────────────── */
function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-4 border-b border-[#F1F5F9]">
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{title}</p>
      {hint && <p className="text-xs text-[#9CA3AF] mt-0.5">{hint}</p>}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────── */
function EmptyPanel({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <Icon className="w-8 h-8 text-[#E5E7EB] mb-3" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-[#374151]">{title}</p>
      <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed max-w-[220px]">{sub}</p>
    </div>
  );
}

/* ── Export row ──────────────────────────────────────────── */
function ExportRow({
  icon: Icon, title, sub, what, onExport,
}: {
  icon: React.ElementType; title: string; sub: string; what: string; onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-[#F1F5F9] last:border-0">
      <div className="w-8 h-8 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#6B7280]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>
        <p className="text-[10px] text-[#D1D5DB] mt-0.5 font-mono">{what}</p>
      </div>
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#374151] border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] px-3 py-1.5 rounded-lg transition-colors shrink-0 shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export function CompliancePage() {
  const { data: compliance, isLoading } = useGetComplianceSummary();
  const { data: deals } = useGetDeals({}, { query: { queryKey: QUERY_KEYS.deals } });
  const { data: payments } = useGetPayments({}, { query: { queryKey: QUERY_KEYS.payments } });
  const { data: expenses } = useGetExpenses({}, { query: { queryKey: QUERY_KEYS.expenses } });

  const cur = compliance?.currency ?? "INR";
  const progress = compliance?.gstThresholdProgress ?? 0;
  const alertLevel = compliance?.gstAlertLevel ?? "safe";
  const taxableRevenue = parseFloat(compliance?.taxableRevenue ?? "0");

  const progressColor =
    alertLevel === "exceeded" ? "#EF4444"
    : alertLevel === "warning" || alertLevel === "approaching" ? "#F59E0B"
    : "#22C55E";

  const alertBadge = {
    exceeded: { text: "Over threshold — consider registering for GST", cls: "text-white bg-[#EF4444]" },
    warning: { text: "Approaching limit — monitor closely", cls: "text-[#B45309] bg-[#F59E0B]/10 border border-[#F59E0B]/30" },
    approaching: { text: "Getting close — keep tracking", cls: "text-[#B45309] bg-amber-50 border border-amber-200" },
    safe: { text: "Well within limit", cls: "text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0]" },
  }[alertLevel];

  const barterDeals = (deals ?? []).filter(d => d.isBarter);
  const tdsDeals = (deals ?? []).filter(d => d.tdsApplicable);
  const pendingInvoiceDeals = (deals ?? []).filter(d => d.invoiceStatus === "raised" || d.invoiceStatus === "sent");

  /* — Export helpers — */
  const handleExportDeals = () => {
    const rows = (deals ?? []).map(d => [
      d.brandName, d.campaignName, d.incomeType,
      d.amountAgreed, (d as any).totalReceived ?? "0", d.status,
      d.invoiceStatus ?? "not_raised", d.invoiceNumber ?? "",
      d.invoiceDate ? formatDate(d.invoiceDate) : "",
      d.gstApplicable ? "Yes" : "No", d.taxableValue ?? "",
      d.tdsApplicable ? "Yes" : "No", d.tdsAmount ?? "",
      d.managerCutType ?? "", d.managerCutValue ?? "",
      d.agencyCutType ?? "", d.agencyCutValue ?? "",
      d.isBarter ? "Yes" : "No", d.barterEstimatedValue ?? "",
    ]);
    downloadCSV("kitna-deals.csv", rows, [
      "Brand", "Campaign", "Type", "Amount Agreed", "Received", "Status",
      "Invoice Status", "Invoice Number", "Invoice Date",
      "GST", "Taxable Value", "TDS", "TDS Amount",
      "Manager Cut Type", "Manager Cut Value", "Agency Cut Type", "Agency Cut Value",
      "Barter", "Barter Value",
    ]);
  };

  const handleExportPayments = () => {
    if (!(payments ?? []).length) { alert("No payments logged yet."); return; }
    const rows = (payments ?? []).map(p => [
      p.receivedDate ? formatDate(p.receivedDate) : "",
      (p as any).dealBrandName ?? "",
      p.amountReceived, p.currency, p.paymentMethod,
      p.tdsApplicable ? "Yes" : "No", (p as any).tdsAmount ?? "",
      p.notes ?? "",
    ]);
    downloadCSV("kitna-payments.csv", rows, [
      "Date", "Brand", "Amount Received", "Currency", "Method",
      "TDS", "TDS Amount", "Note",
    ]);
  };

  const handleExportExpenses = () => {
    if (!(expenses ?? []).length) { alert("No expenses logged yet."); return; }
    const rows = (expenses ?? []).map(e => [
      e.expenseDate ? formatDate(e.expenseDate) : "",
      e.title, e.category, e.amount, e.currency,
      (e as any).vendorOrPayee ?? "",
      (e as any).dealBrandName ?? "",
      (e as any).isRecurring ? "Yes" : "No",
      (e as any).recurringFrequency ?? "",
      e.notes ?? "",
    ]);
    downloadCSV("kitna-expenses.csv", rows, [
      "Date", "Description", "Category", "Amount", "Currency",
      "Vendor", "Deal", "Recurring", "Frequency", "Notes",
    ]);
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[120, 200, 80].map((w, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Compliance</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">India-ready tax tracking — GST, TDS, invoices, and export for your CA</p>
      </div>

      {/* GST threshold — hero block */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            {alertLevel === "exceeded" || alertLevel === "warning" ? (
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0" />
            )}
            <p className="text-sm font-bold text-[#111827]">GST Threshold Tracker</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-[#111827] tabular-nums">{formatCurrency(taxableRevenue, cur)}</p>
            <p className="text-[11px] text-[#9CA3AF]">GST-applicable revenue tracked</p>
          </div>
        </div>

        <p className="text-xs text-[#9CA3AF] mb-5">
          India's GST registration threshold is {formatCurrency(GST_THRESHOLD, cur)} / financial year.
          Only deals marked as GST applicable are counted here.
        </p>

        <div className="mb-2">
          <div className="h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-[#9CA3AF]">
            {taxableRevenue > 0
              ? `${progress.toFixed(1)}% of ${formatCurrency(GST_THRESHOLD, cur)} threshold used`
              : "No GST-applicable deals tracked yet"}
          </p>
          {alertBadge && (
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${alertBadge.cls}`}>
              {alertBadge.text}
            </span>
          )}
        </div>

        {taxableRevenue === 0 && (
          <div className="mt-4 flex items-start gap-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-4 py-3">
            <Info className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 mt-0.5" />
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Mark deals as GST applicable when adding or editing them. This keeps your threshold tracking accurate.
            </p>
          </div>
        )}
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="TDS Deducted"
          value={parseFloat(compliance?.tdsDeducted ?? "0") > 0 ? formatCurrency(compliance!.tdsDeducted!, cur) : "₹0"}
          sub={
            (compliance?.tdsDeals ?? 0) > 0
              ? `Across ${compliance!.tdsDeals} deal${compliance!.tdsDeals !== 1 ? "s" : ""}`
              : "No TDS-tracked deals yet"
          }
          icon={IndianRupee}
          iconColor="blue"
          accentColor="text-[#2563EB]"
        />
        <StatCard
          label="Barter Value"
          value={parseFloat(compliance?.barterValue ?? "0") > 0 ? formatCurrency(compliance!.barterValue!, cur) : "₹0"}
          sub={
            (compliance?.barterDeals ?? 0) > 0
              ? `${compliance!.barterDeals} barter deal${compliance!.barterDeals !== 1 ? "s" : ""} logged`
              : "No barter deals logged yet"
          }
          icon={Tag}
          iconColor="purple"
          accentColor="text-[#7C3AED]"
        />
        <StatCard
          label="Invoices Raised"
          value={String(compliance?.invoicesRaised ?? 0)}
          sub={
            (compliance?.invoicesRaised ?? 0) > 0
              ? `${compliance?.invoicesPaid ?? 0} paid · ${(compliance?.invoicesRaised ?? 0) - (compliance?.invoicesPaid ?? 0)} outstanding`
              : "No invoices raised yet"
          }
          icon={FileText}
          iconColor="green"
          accentColor="text-[#111827]"
        />
        <StatCard
          label="Invoices Pending"
          value={String(compliance?.invoicesPending ?? 0)}
          sub={
            (compliance?.invoicesPending ?? 0) > 0
              ? "Sent or raised, not yet paid — follow up"
              : "All invoices settled"
          }
          icon={Receipt}
          iconColor={(compliance?.invoicesPending ?? 0) > 0 ? "amber" : "green"}
          accentColor={(compliance?.invoicesPending ?? 0) > 0 ? "text-[#F59E0B]" : "text-[#9CA3AF]"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* TDS deals */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <SectionHeader
            title="TDS Deals"
            hint="Deals where tax was deducted at source before payment"
          />
          {tdsDeals.length === 0 ? (
            <EmptyPanel
              icon={IndianRupee}
              title="No TDS-tracked deals yet"
              sub="Mark a deal as TDS-applicable when adding it to track deducted amounts and simplify tax records"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Deal Value</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">TDS Deducted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {tdsDeals.map(d => (
                  <tr key={d.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#111827]">{d.brandName}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate max-w-[130px]">{d.campaignName}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#6B7280] tabular-nums">
                      {formatCurrency(d.amountAgreed, cur)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.tdsAmount
                        ? <span className="text-sm font-bold text-[#2563EB]">{formatCurrency(d.tdsAmount, cur)}</span>
                        : <span className="text-sm text-[#D1D5DB]">Not entered</span>
                      }
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#F8FAFC] border-t border-[#E5E7EB]">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-[#6B7280]">Total TDS</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-[#2563EB] tabular-nums">
                    {formatCurrency(compliance?.tdsDeducted ?? "0", cur)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Barter log */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <SectionHeader
            title="Barter & Gifted Products"
            hint="Log freebies and barter deals — useful for tax records and tracking value received"
          />
          {barterDeals.length === 0 ? (
            <EmptyPanel
              icon={Tag}
              title="No barter deals logged yet"
              sub="Got a free product, a subscription, or a barter collab? Log it here to track value received and stay CA-ready"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Received</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Est. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {barterDeals.map(d => (
                  <tr key={d.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#111827]">{d.brandName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280] max-w-[130px]">
                      <span className="truncate block">{d.barterDescription || d.campaignName}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.barterEstimatedValue
                        ? <span className="text-sm font-bold text-[#7C3AED]">{formatCurrency(d.barterEstimatedValue, cur)}</span>
                        : <span className="text-sm text-[#D1D5DB]">—</span>
                      }
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#F8FAFC] border-t border-[#E5E7EB]">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-[#6B7280]">Total barter value</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-[#7C3AED] tabular-nums">
                    {formatCurrency(compliance?.barterValue ?? "0", cur)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pending invoices — always visible block, even if empty */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mb-5">
        <SectionHeader
          title={pendingInvoiceDeals.length > 0 ? `Pending Invoices — ${pendingInvoiceDeals.length} need follow-up` : "Invoice Tracker"}
          hint="Invoices raised or sent but not yet marked as paid"
        />
        {pendingInvoiceDeals.length === 0 ? (
          <EmptyPanel
            icon={FileText}
            title="No pending invoices"
            sub="When you raise an invoice for a deal and it hasn't been paid yet, it will show up here for easy follow-up"
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Invoice #</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Invoice Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC]">
              {pendingInvoiceDeals.map(d => (
                <tr key={d.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-[#111827]">{d.brandName}</p>
                    <p className="text-xs text-[#9CA3AF] truncate max-w-[180px]">{d.campaignName}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#9CA3AF] hidden md:table-cell">
                    {d.invoiceNumber || <span className="text-[#D1D5DB]">Not entered</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${INVOICE_STATUS_COLORS[d.invoiceStatus ?? "not_raised"]}`}>
                      {INVOICE_STATUS_LABELS[d.invoiceStatus ?? "not_raised"]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-bold text-[#B45309]">
                      {formatCurrency(d.invoiceAmount || d.amountAgreed, cur)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Export section */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#F1F5F9]">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Export for CA / Accountant</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Clean CSV files ready to share with your CA, import into Sheets, or attach to your tax folder.</p>
        </div>
        <div className="px-6 py-1">
          <ExportRow
            icon={FileText}
            title="Deals export"
            sub="All deals with invoice status, GST and TDS flags, manager/agency cuts, and barter details"
            what="deal_value · invoice_status · gst · tds · cuts · barter"
            onExport={handleExportDeals}
          />
          <ExportRow
            icon={IndianRupee}
            title="Payments export"
            sub="All payments received, including method, date, and TDS deduction details"
            what="date · brand · amount · method · tds_amount"
            onExport={handleExportPayments}
          />
          <ExportRow
            icon={Receipt}
            title="Expenses export"
            sub="All expenses by category, with vendor, linked campaign, and recurring flag"
            what="date · category · vendor · amount · deal_linked"
            onExport={handleExportExpenses}
          />
          <ExportRow
            icon={Tag}
            title="Monthly summary"
            sub="Month-by-month income received, expenses, pending receivables, and net profit"
            what="month · income · expenses · pending · net"
            onExport={() => alert("Monthly summary export coming soon — log more data first")}
          />
        </div>
      </div>
    </div>
  );
}
