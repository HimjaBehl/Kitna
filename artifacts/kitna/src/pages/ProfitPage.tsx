import { useGetProfitSummary } from "@workspace/api-client-react";
import { formatCurrency, expenseCategoryLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { TrendingUp, Lightbulb, PackageOpen } from "lucide-react";

const DONUT_COLORS = ["#22C55E", "#2563EB", "#F59E0B", "#7C3AED", "#6B7280", "#EF4444", "#15803D"];

/* ── Helpers ─────────────────────────────────────────────── */
function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function insightLines(
  booked: number, received: number, pending: number,
  expenses: number, net: number, potential: number, cur: string,
): string[] {
  const lines: string[] = [];

  if (booked === 0) {
    lines.push("Add your first deal to start tracking income and profit.");
    return lines;
  }

  const collectedPct = pct(received, booked);
  if (collectedPct === 100) {
    lines.push("All booked income has been collected.");
  } else if (collectedPct > 0) {
    lines.push(`${collectedPct}% of booked income has been collected — ${formatCurrency(pending, cur)} is still pending.`);
  } else {
    lines.push(`${formatCurrency(booked, cur)} booked, but no payments received yet.`);
  }

  if (expenses === 0 && received > 0) {
    lines.push("No expenses logged yet — current profit equals cash received.");
  } else if (expenses > 0 && net > 0) {
    const marginPct = pct(net, received);
    if (marginPct > 0) lines.push(`You're keeping ${marginPct}% of what you've collected after expenses.`);
  }

  if (pending > 0 && potential > net) {
    lines.push(`Potential profit rises to ${formatCurrency(potential, cur)} if all pending payments come in.`);
  }

  return lines.slice(0, 2);
}

/* ── P&L row ─────────────────────────────────────────────── */
function PLRow({
  label, value, sub, color, size = "normal", dimmed,
}: {
  label: string; value: string; sub?: string;
  color?: string; size?: "normal" | "large"; dimmed?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3 border-b border-[#F1F5F9] last:border-0 ${dimmed ? "opacity-60" : ""}`}>
      <div>
        <p className={`font-medium text-[#374151] ${size === "large" ? "text-sm" : "text-sm"}`}>{label}</p>
        {sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>}
      </div>
      <p className={`font-bold tabular-nums ${size === "large" ? "text-lg" : "text-sm"} ${color ?? "text-[#111827]"}`}>{value}</p>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────── */
function EmptyBlock({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <Icon className="w-8 h-8 text-[#E5E7EB] mb-3" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-[#374151]">{title}</p>
      <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{sub}</p>
    </div>
  );
}

/* ── Custom bar chart tooltip ────────────────────────────── */
function BarTooltip({ active, payload, label, cur }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 shadow-lg text-xs">
      <p className="font-bold text-[#111827] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
          <span className="text-[#6B7280]">{p.name}:</span>
          <span className="font-semibold text-[#111827]">{formatCurrency(p.value, cur)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="border-t border-[#F1F5F9] pt-1.5 mt-1.5">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Net:</span>
            <span className={`font-bold ${payload[0].value - payload[1].value >= 0 ? "text-[#15803D]" : "text-[#EF4444]"}`}>
              {formatCurrency(payload[0].value - payload[1].value, cur)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export function ProfitPage() {
  const { data: profit, isLoading } = useGetProfitSummary();
  const cur = profit?.currency ?? "INR";

  if (isLoading) return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      {[100, 160, 80].map((w, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
      ))}
    </div>
  );

  const bookedNum = parseFloat(profit?.totalBooked ?? "0");
  const receivedNum = parseFloat(profit?.totalReceived ?? "0");
  const pendingNum = parseFloat(profit?.pendingReceivables ?? "0");
  const expensesNum = parseFloat(profit?.totalExpenses ?? "0");
  const netNum = parseFloat(profit?.netProfit ?? "0");
  const potentialNum = parseFloat(profit?.potentialProfit ?? "0");

  const insights = insightLines(bookedNum, receivedNum, pendingNum, expensesNum, netNum, potentialNum, cur);

  const pieData = (profit?.expensesByCategory ?? [])
    .filter(e => parseFloat(e.amount) > 0)
    .map(e => ({ name: expenseCategoryLabel(e.category), value: parseFloat(e.amount) }));

  const barData = (profit?.topDeals ?? []).slice(0, 8).map(d => ({
    name: d.brandName.length > 11 ? d.brandName.slice(0, 11) + "…" : d.brandName,
    fullName: d.brandName,
    Received: parseFloat(d.totalReceived),
    Expenses: parseFloat(d.linkedExpenses),
  }));

  const hasDeals = (profit?.topDeals ?? []).length > 0;
  const hasExpenses = expensesNum > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Profit</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">Your creator P&L — booked, collected, spent, and kept</p>
      </div>

      {/* Insight strip */}
      {insights.length > 0 && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
          <Lightbulb className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {insights.map((line, i) => (
              <p key={i} className="text-sm text-[#15803D] leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">

        {/* P&L Summary */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-4">P&L Summary</p>
          <PLRow
            label="Total Booked"
            sub="Agreed value across all active deals"
            value={formatCurrency(bookedNum, cur)}
          />
          <PLRow
            label="Collected"
            sub="Payments received so far"
            value={formatCurrency(receivedNum, cur)}
            color="text-[#15803D]"
          />
          <PLRow
            label="Still Pending"
            sub="Owed but not yet paid"
            value={pendingNum > 0 ? formatCurrency(pendingNum, cur) : "—"}
            color={pendingNum > 0 ? "text-[#B45309]" : "text-[#9CA3AF]"}
          />
          <PLRow
            label="Total Expenses"
            sub="All costs logged"
            value={hasExpenses ? formatCurrency(expensesNum, cur) : "—"}
            color={hasExpenses ? "text-[#EF4444]" : "text-[#9CA3AF]"}
          />
          <div className="pt-4 border-t border-[#E5E7EB] mt-1">
            <PLRow
              label="Net Profit"
              sub="Collected minus expenses"
              value={formatCurrency(netNum, cur)}
              color={netNum >= 0 ? "text-[#15803D]" : "text-[#EF4444]"}
              size="large"
            />
            {pendingNum > 0 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-[#9CA3AF]">Potential (if all pending paid)</p>
                <p className="text-xs font-semibold text-[#6B7280]">{formatCurrency(potentialNum, cur)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Expense donut */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-4">Expenses by Category</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="42%" outerRadius={72} innerRadius={40}
                  dataKey="value" paddingAngle={3} strokeWidth={0}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v, cur), ""]}
                  contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 12, fontSize: 12, padding: "8px 12px" }}
                  labelStyle={{ display: "none" }}
                />
                <Legend
                  iconSize={6} iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#6B7280", lineHeight: "20px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBlock
              icon={PackageOpen}
              title="No expenses logged yet"
              sub="Add expenses to see how your spending breaks down by category"
            />
          )}
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-4">Category Breakdown</p>
          {(profit?.expensesByCategory ?? []).length > 0 ? (
            <div className="space-y-3.5">
              {(profit?.expensesByCategory ?? []).map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-[#374151] truncate">{expenseCategoryLabel(cat.category)}</p>
                      <p className="text-xs font-bold text-[#6B7280] ml-2 shrink-0">{cat.percentage}%</p>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[#9CA3AF] shrink-0 w-20 text-right tabular-nums">
                    {formatCurrency(cat.amount, cur)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock
              icon={TrendingUp}
              title="Nothing here yet"
              sub="Once you log recurring costs, this section will show what's eating into profit"
            />
          )}
        </div>
      </div>

      {/* Deal performance chart */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Deal Performance</p>
          {barData.length > 0 && (
            <p className="text-[11px] text-[#9CA3AF]">Received vs. linked expenses per deal</p>
          )}
        </div>

        {barData.length > 0 ? (
          <div className="mt-5">
            <ResponsiveContainer width="100%" height={barData.length === 1 ? 140 : 210}>
              <BarChart
                data={barData}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                barGap={3}
                barCategoryGap={barData.length <= 2 ? "50%" : "35%"}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  width={44}
                />
                <Tooltip content={<BarTooltip cur={cur} />} cursor={{ fill: "#F8FAFC" }} />
                <Bar dataKey="Received" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={48} />
                <Bar dataKey="Expenses" fill="#FCA5A5" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 justify-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                <span className="text-[11px] text-[#6B7280]">Received</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FCA5A5]" />
                <span className="text-[11px] text-[#6B7280]">Linked expenses</span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyBlock
            icon={TrendingUp}
            title="No deals to chart yet"
            sub="Add deals and log payments to see income vs. cost performance per campaign"
          />
        )}
      </div>

      {/* Deal profitability table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Deal Profitability</p>
            {hasDeals && (
              <p className="text-xs text-[#9CA3AF] mt-0.5">Income received minus direct deal expenses</p>
            )}
          </div>
        </div>

        {hasDeals ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider hidden lg:table-cell">Campaign</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Agreed</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Collected</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Expenses</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC]">
              {(profit?.topDeals ?? []).map(d => {
                const netVal = parseFloat(d.netValue);
                const agreedVal = parseFloat(d.amountAgreed);
                const recVal = parseFloat(d.totalReceived);
                const pendingVal = Math.max(agreedVal - recVal, 0);
                return (
                  <tr key={d.dealId} className="hover:bg-[#F8FAFC] transition-colors group">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[#111827]">{d.brandName}</p>
                      {pendingVal > 0 && (
                        <p className="text-[11px] text-[#B45309] mt-0.5">
                          {formatCurrency(pendingVal, cur)} pending
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#6B7280] max-w-[200px] hidden lg:table-cell">
                      <span className="truncate block">{d.campaignName}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-[#9CA3AF] tabular-nums hidden md:table-cell">
                      {formatCurrency(d.amountAgreed, cur)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-[#15803D] tabular-nums">
                      {recVal > 0 ? formatCurrency(d.totalReceived, cur) : <span className="text-[#D1D5DB]">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right text-sm tabular-nums hidden md:table-cell">
                      {parseFloat(d.linkedExpenses) > 0
                        ? <span className="text-[#EF4444]">-{formatCurrency(d.linkedExpenses, cur)}</span>
                        : <span className="text-[#D1D5DB]">—</span>
                      }
                    </td>
                    <td className={`px-5 py-4 text-right text-sm font-bold tabular-nums ${netVal >= 0 ? "text-[#15803D]" : "text-[#EF4444]"}`}>
                      {formatCurrency(d.netValue, cur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyBlock
            icon={PackageOpen}
            title="No deals yet"
            sub="Add deals and log payments to see per-campaign profitability here"
          />
        )}
      </div>
    </div>
  );
}
