import { useGetReceivables } from "@workspace/api-client-react";
import { formatCurrency, formatDate, incomeTypeLabel } from "@/lib/format";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

function DaysOverdueBadge({ days }: { days: number | null | undefined }) {
  if (days == null || days <= 0) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444] text-white">
      {days}d late
    </span>
  );
}

function DaysDueBadge({ dueDate }: { dueDate: string | Date | null | undefined }) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/10 text-[#B45309] border border-[#F59E0B]/20">Due today</span>;
  if (diff <= 7) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Due in {diff}d</span>;
  return null;
}

export function ReceivablesPage() {
  const { data: receivables, isLoading } = useGetReceivables();

  const overdue = (receivables ?? []).filter(r => r.status === "overdue");
  const pending = (receivables ?? []).filter(r => r.status !== "overdue");

  const totalPending = (receivables ?? []).reduce((s, r) => s + parseFloat(r.pendingAmount), 0);
  const totalOverdue = overdue.reduce((s, r) => s + parseFloat(r.pendingAmount), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Receivables</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">Money owed to you — follow up before it gets late</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Total Pending</p>
          </div>
          <p className="text-2xl font-bold text-[#2563EB]">{formatCurrency(totalPending, "INR")}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-2">{(receivables ?? []).length} deal{(receivables ?? []).length !== 1 ? "s" : ""} outstanding</p>
        </div>
        <div className={`rounded-2xl p-5 ${overdue.length > 0 ? "bg-[#EF4444] border border-[#EF4444]" : "bg-white border border-[#E5E7EB]"}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-1.5 h-1.5 rounded-full ${overdue.length > 0 ? "bg-white" : "bg-[#9CA3AF]"}`} />
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${overdue.length > 0 ? "text-red-100" : "text-[#6B7280]"}`}>Overdue</p>
          </div>
          <p className={`text-2xl font-bold ${overdue.length > 0 ? "text-white" : "text-[#9CA3AF]"}`}>{formatCurrency(totalOverdue, "INR")}</p>
          <p className={`text-[11px] mt-2 ${overdue.length > 0 ? "text-red-200" : "text-[#9CA3AF]"}`}>{overdue.length} deal{overdue.length !== 1 ? "s" : ""} past due date</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Upcoming</p>
          </div>
          <p className="text-2xl font-bold text-[#B45309]">{pending.length}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-2">deal{pending.length !== 1 ? "s" : ""} in pipeline</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-32" /><div className="h-3 bg-gray-100 rounded w-48" /></div>
                <div className="h-6 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (receivables ?? []).length === 0 && (
        <div className="bg-[#F0FDF4] border border-[#22C55E]/20 rounded-2xl p-14 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto mb-3" />
          <p className="text-[#15803D] font-bold text-lg">All clear!</p>
          <p className="text-[#166534]/60 text-sm mt-1">No pending receivables. Everyone has paid up.</p>
        </div>
      )}

      {/* Overdue section */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <p className="text-xs font-bold text-[#EF4444] uppercase tracking-wider">Overdue — Follow up now</p>
          </div>
          <div className="rounded-2xl border-2 border-[#FECACA] overflow-hidden shadow-sm shadow-red-50">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EF4444] border-b border-red-400">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider">Brand</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider hidden md:table-cell">Campaign</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider hidden lg:table-cell">Type</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider">Due Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider">Late</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider">Agreed</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider">Got</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-red-100 uppercase tracking-wider">You're owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {overdue.map(r => (
                  <tr key={r.dealId} className="bg-red-50 hover:bg-red-100/50 transition-colors">
                    <td className="px-5 py-4"><p className="text-sm font-bold text-[#111827]">{r.brandName}</p></td>
                    <td className="px-5 py-4 text-sm text-[#374151] hidden md:table-cell">{r.campaignName}</td>
                    <td className="px-5 py-4 text-sm text-[#6B7280] hidden lg:table-cell">{incomeTypeLabel(r.incomeType)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#EF4444]">{formatDate(r.dueDate)}</td>
                    <td className="px-5 py-4"><DaysOverdueBadge days={r.daysPending} /></td>
                    <td className="px-5 py-4 text-right text-sm text-[#6B7280]">{formatCurrency(r.amountAgreed, r.currency)}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-[#15803D]">{formatCurrency(r.totalReceived, r.currency)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-base font-extrabold text-[#EF4444]">{formatCurrency(r.pendingAmount, r.currency)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending section */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#F59E0B]" />
            <p className="text-xs font-bold text-[#B45309] uppercase tracking-wider">Pending</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Campaign</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider hidden lg:table-cell">Type</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Due Date</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Agreed</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Received</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Still Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {pending.map(r => (
                  <tr key={r.dealId} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-3.5"><p className="text-sm font-semibold text-[#111827]">{r.brandName}</p></td>
                    <td className="px-5 py-3.5 text-sm text-[#6B7280] hidden md:table-cell">{r.campaignName}</td>
                    <td className="px-5 py-3.5 text-sm text-[#9CA3AF] hidden lg:table-cell">{incomeTypeLabel(r.incomeType)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#6B7280]">{formatDate(r.dueDate)}</span>
                        <DaysDueBadge dueDate={r.dueDate} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-[#6B7280]">{formatCurrency(r.amountAgreed, r.currency)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#15803D]">{formatCurrency(r.totalReceived, r.currency)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-[#B45309]">{formatCurrency(r.pendingAmount, r.currency)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
