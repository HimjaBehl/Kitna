import { useState } from "react";
import { useGetDashboardSummary, useGetMonthlyTrend, useGetIncomeByType, useGetRecentActivity } from "@workspace/api-client-react";
import { formatCurrency, formatDate, incomeTypeLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { QuickAddDealModal, QuickAddPaymentModal, QuickAddExpenseModal } from "@/components/QuickAddModals";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, IndianRupee, Plus, Briefcase } from "lucide-react";

const DONUT_COLORS = ["#22C55E", "#2563EB", "#F59E0B", "#0F172A", "#6B7280", "#15803D"];

/* ─── Hero card ─────────────────────────────────────────── */
function HeroCard({ value, potential, negative }: {
  value: string; potential?: string; negative?: boolean;
}) {
  return (
    <div className="bg-[#0F172A] rounded-xl p-5 flex flex-col justify-between h-full min-h-[130px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[#22C55E] text-[10px] font-bold uppercase tracking-widest leading-none">
            kitna actual bana?
          </p>
          <p className="text-[#475569] text-[11px] mt-1">after everything</p>
        </div>
        {potential && (
          <div className="text-right shrink-0">
            <p className="text-[#334155] text-[10px] uppercase tracking-wide leading-none">Potential</p>
            <p className="text-[#64748B] text-xs font-semibold mt-0.5">{potential}</p>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-white text-[2.1rem] font-bold tracking-tight leading-none">{value}</p>
        <p className="text-[#22C55E]/60 text-[11px] mt-1.5 font-medium">you kept</p>
        {negative && (
          <p className="text-[#475569] text-[10px] mt-1">Spent more than you earned.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Metric card ────────────────────────────────────────── */
type MetricColor = "green" | "blue" | "amber" | "red";

function MetricCard({ label, value, sub, color = "blue" }: {
  label: string; value: string; sub?: string; color?: MetricColor;
}) {
  const dot = {
    green: "bg-[#22C55E]",
    blue: "bg-[#94A3B8]",
    amber: "bg-[#F59E0B]",
    red: "bg-[#EF4444]",
  }[color];
  const val = {
    green: "text-[#15803D]",
    blue: "text-[#1E293B]",
    amber: "text-[#B45309]",
    red: "text-[#DC2626]",
  }[color];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 py-3 flex flex-col justify-between">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <p className="text-[#9CA3AF] text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-[17px] font-bold tracking-tight leading-none ${val}`}>{value}</p>
      {sub && <p className="text-[#D1D5DB] text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

/* ─── Insight strip ──────────────────────────────────────── */
function InsightStrip({ summary, cur }: { summary: any; cur: string }) {
  const booked = parseFloat(summary?.totalBooked ?? "0");
  const received = parseFloat(summary?.totalReceived ?? "0");
  const pending = parseFloat(summary?.pendingReceivables ?? "0");
  const overdueCount = summary?.overdueCount ?? 0;
  if (booked === 0) return null;

  const pct = Math.round((received / booked) * 100);
  let text = "";
  if (overdueCount > 0 && pending > 0) {
    text = `${formatCurrency(pending, cur)} is stuck — ${overdueCount} deal${overdueCount > 1 ? "s" : ""} overdue. Worth a follow-up.`;
  } else if (pct < 60 && pending > 0) {
    text = `You've received ${pct}% of what you booked. ${formatCurrency(pending, cur)} still to come.`;
  } else if (pct >= 90) {
    text = `${pct}% of booked has landed. Clean collection rate.`;
  } else {
    text = `${formatCurrency(received, cur)} received of ${formatCurrency(booked, cur)} booked — ${pct}%.`;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-[#E5E7EB]">
      <span className="text-[#22C55E] text-sm leading-none shrink-0">→</span>
      <p className="text-[#374151] text-xs leading-snug">{text}</p>
    </div>
  );
}

/* ─── Chart tooltip ──────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label, cur }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#111827] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke }}>
          {p.dataKey === "received" ? "You got" : "You spent"} {formatCurrency(p.value, cur)}
        </p>
      ))}
    </div>
  );
};

/* ─── Main page ──────────────────────────────────────────── */
type QuickModal = "deal" | "payment" | "expense" | null;

export function DashboardPage() {
  const [modal, setModal] = useState<QuickModal>(null);
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: trend } = useGetMonthlyTrend();
  const { data: byType } = useGetIncomeByType();
  const { data: recent } = useGetRecentActivity();

  const cur = summary?.currency ?? "INR";
  const netProfitNum = parseFloat(summary?.netProfit ?? "0");
  const overdueCount = summary?.overdueCount ?? 0;

  const pieData = (byType ?? [])
    .filter(d => parseFloat(d.amount) > 0)
    .map(d => ({ name: incomeTypeLabel(d.type), value: parseFloat(d.amount) }));

  if (isLoading) {
    return (
      <div className="px-6 py-5 max-w-7xl mx-auto space-y-3">
        <div className="h-5 bg-gray-200 rounded w-28 animate-pulse" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-[#E5E7EB] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 max-w-7xl mx-auto space-y-3">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#111827] tracking-tight leading-none">Overview</h1>
          <p className="text-[#9CA3AF] text-xs mt-1">your money, clearly</p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-[#EF4444] shrink-0" />
              <p className="text-[#EF4444] text-xs font-medium">{overdueCount} overdue</p>
            </div>
          )}
          <button
            onClick={() => setModal("deal")}
            className="flex items-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-green-200"
          >
            <Plus className="w-3 h-3" strokeWidth={2.5} /> Add Deal
          </button>
          <button
            onClick={() => setModal("payment")}
            className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-blue-200"
          >
            <Plus className="w-3 h-3" strokeWidth={2.5} /> Add Payment
          </button>
          <button
            onClick={() => setModal("expense")}
            className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-[#111827] text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E7EB] transition-colors"
          >
            <Plus className="w-3 h-3" strokeWidth={2.5} /> Add Expense
          </button>
        </div>
      </div>

      {/* ── Top row: hero + 4 metrics ──────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {/* Hero — 2 cols */}
        <div className="col-span-2">
          <HeroCard
            value={formatCurrency(summary?.netProfit ?? "0", cur)}
            potential={netProfitNum >= 0 ? formatCurrency(summary?.potentialProfit ?? "0", cur) : undefined}
            negative={netProfitNum < 0}
          />
        </div>
        {/* 4 metric cards — 2×2 grid in remaining 3 cols */}
        <div className="col-span-3 grid grid-cols-2 grid-rows-2 gap-3">
          <MetricCard
            label="Booked"
            value={formatCurrency(summary?.totalBooked ?? "0", cur)}
            sub={`${summary?.activeDealsCount ?? 0} active deal${(summary?.activeDealsCount ?? 0) !== 1 ? "s" : ""}`}
            color="blue"
          />
          <MetricCard
            label="Received"
            value={formatCurrency(summary?.totalReceived ?? "0", cur)}
            color="green"
          />
          <MetricCard
            label="Still to come"
            value={formatCurrency(summary?.pendingReceivables ?? "0", cur)}
            sub={overdueCount ? `${overdueCount} overdue` : undefined}
            color="amber"
          />
          <MetricCard
            label="You spent"
            value={formatCurrency(summary?.totalExpenses ?? "0", cur)}
            color="red"
          />
        </div>
      </div>

      {/* ── Insight strip ──────────────────────────────── */}
      {summary && <InsightStrip summary={summary} cur={cur} />}

      {/* ── Charts ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Area chart */}
        <div className="col-span-2 bg-white rounded-xl border border-[#E5E7EB] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">How your money moved</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <span className="w-2.5 h-px bg-[#22C55E] inline-block" /> Money in
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <span className="w-2.5 h-px bg-[#EF4444] inline-block opacity-60" /> Money out
              </span>
            </div>
          </div>
          {(trend ?? []).some(t => parseFloat(t.received) > 0 || parseFloat(t.expenses) > 0) ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trend ?? []} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-received" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-expenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.07} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<ChartTooltip cur={cur} />} />
                <Area type="monotone" dataKey="received" stroke="#22C55E" strokeWidth={2} fill="url(#grad-received)" dot={false} />
                <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={1.5} fill="url(#grad-expenses)" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex flex-col items-center justify-center text-[#9CA3AF] gap-2">
              <TrendingUp className="w-6 h-6 text-[#E5E7EB]" />
              <p className="text-xs">Add payments and expenses to see your trend</p>
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 pt-4 pb-3">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Where it came from</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="42%" outerRadius={52} innerRadius={28}
                  dataKey="value" paddingAngle={3} strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, cur)}
                  contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }} />
                <Legend iconSize={6} iconType="circle" wrapperStyle={{ fontSize: 10, color: "#6B7280" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[140px] flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full border-4 border-[#F1F5F9] border-dashed" />
              <p className="text-[#9CA3AF] text-xs">No income yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent activity ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Recent Deals */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 pt-4 pb-3">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Recent Deals</p>
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
            {(recent?.deals ?? []).length === 0 ? (
              <div className="py-5 text-center">
                <Briefcase className="w-5 h-5 text-[#E5E7EB] mx-auto mb-1.5" />
                <p className="text-[#9CA3AF] text-xs">No deals yet</p>
              </div>
            ) : (recent?.deals ?? []).map(deal => (
              <div key={deal.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#111827] truncate">{deal.brandName}</p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{deal.campaignName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#111827]">{formatCurrency(deal.amountAgreed, deal.currency)}</p>
                  <StatusBadge status={deal.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 pt-4 pb-3">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Recent Payments</p>
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
            {(recent?.payments ?? []).length === 0 ? (
              <div className="py-5 text-center">
                <IndianRupee className="w-5 h-5 text-[#E5E7EB] mx-auto mb-1.5" />
                <p className="text-[#9CA3AF] text-xs">No payments yet</p>
              </div>
            ) : (recent?.payments ?? []).map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#111827] truncate">{p.dealBrandName ?? "Direct"}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{formatDate(p.receivedDate)}</p>
                </div>
                <p className="text-xs font-bold text-[#15803D] shrink-0">+{formatCurrency(p.amountReceived, p.currency)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 pt-4 pb-3">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Recent Expenses</p>
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
            {(recent?.expenses ?? []).length === 0 ? (
              <div className="py-5 text-center">
                <TrendingDown className="w-5 h-5 text-[#E5E7EB] mx-auto mb-1.5" />
                <p className="text-[#9CA3AF] text-xs">No expenses yet</p>
              </div>
            ) : (recent?.expenses ?? []).map(e => (
              <div key={e.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#111827] truncate">{e.title}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{formatDate(e.expenseDate)}</p>
                </div>
                <p className="text-xs font-bold text-[#EF4444] shrink-0">-{formatCurrency(e.amount, e.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal === "deal" && <QuickAddDealModal onClose={() => setModal(null)} />}
      {modal === "payment" && <QuickAddPaymentModal onClose={() => setModal(null)} />}
      {modal === "expense" && <QuickAddExpenseModal onClose={() => setModal(null)} />}
    </div>
  );
}
