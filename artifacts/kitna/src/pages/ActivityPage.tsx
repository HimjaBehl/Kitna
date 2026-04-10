import { useState, useEffect } from "react";
import { getActivity, discardDraft, type ExtractionDraft } from "@/lib/assist";
import { formatDate } from "@/lib/format";
import { Sparkles, ImageIcon, FileText, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function confidenceColor(c: string) {
  if (c === "high") return "text-[#15803D] bg-[#F0FDF4] border-[#22C55E]/20";
  if (c === "medium") return "text-[#B45309] bg-amber-50 border-amber-200";
  return "text-[#9CA3AF] bg-[#F8FAFC] border-[#E5E7EB]";
}

function statusConfig(s: string) {
  if (s === "confirmed") return { label: "Created", icon: CheckCircle2, cls: "text-[#15803D] bg-[#F0FDF4]" };
  if (s === "discarded") return { label: "Discarded", icon: XCircle, cls: "text-[#9CA3AF] bg-[#F8FAFC]" };
  return { label: "Draft", icon: Clock, cls: "text-[#B45309] bg-amber-50" };
}

function entryTypeLabel(t: string) {
  const m: Record<string, string> = { deal: "Deal", payment: "Payment", expense: "Expense", barter: "Barter", unknown: "Unknown" };
  return m[t] ?? t;
}

function DraftCard({ draft, onDiscard }: { draft: ExtractionDraft; onDiscard: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const st = statusConfig(draft.status);
  const Icon = st.icon;
  const ex = draft.extractedJson;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-center shrink-0 mt-0.5">
            {draft.sourceType === "csv" ? <FileText className="w-4 h-4 text-[#6B7280]" /> : <ImageIcon className="w-4 h-4 text-[#6B7280]" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-[#111827]">
                {ex?.brand_name ?? ex?.counterparty ?? "—"}
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F8FAFC] text-[#6B7280] border border-[#E5E7EB] uppercase tracking-wide">
                {entryTypeLabel(draft.entryType)}
              </span>
              {ex?.confidence && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wide ${confidenceColor(ex.confidence)}`}>
                  {ex.confidence} confidence
                </span>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{ex?.reasoning_summary ?? "No summary available"}</p>
            <p className="text-[11px] text-[#D1D5DB] mt-1">{formatDate(draft.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.cls}`}>
            <Icon className="w-3 h-3" />
            {st.label}
          </span>
          {draft.status === "draft" && (
            <button
              onClick={onDiscard}
              className="text-[11px] text-[#9CA3AF] hover:text-[#EF4444] px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Discard
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-[#9CA3AF] hover:text-[#6B7280] rounded-lg">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && ex && (
        <div className="px-5 pb-4 border-t border-[#F8FAFC] pt-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {[
              ["Amount", ex.amount != null ? `${ex.currency ?? "INR"} ${ex.amount.toLocaleString("en-IN")}` : null],
              ["Campaign", ex.campaign_name],
              ["Date", ex.date_detected],
              ["Due Date", ex.due_date],
              ["Platform", ex.platform_source],
              ["Payment Status", ex.payment_status],
              ["Income Type", ex.income_type],
              ["Barter", ex.is_barter ? "Yes" : null],
              ["Description", ex.description],
            ].map(([label, value]) => value ? (
              <div key={label as string}>
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
                <p className="text-xs text-[#374151] mt-0.5">{value}</p>
              </div>
            ) : null)}
          </div>
          {ex.missing_fields?.length > 0 && (
            <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2">
              <p className="text-[11px] text-amber-700"><span className="font-semibold">Missing:</span> {ex.missing_fields.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ActivityPage() {
  const [drafts, setDrafts] = useState<ExtractionDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getActivity();
      setDrafts(data);
    } catch {
      toast.error("Could not load activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDiscard = async (id: number) => {
    try {
      await discardDraft(id);
      toast.success("Draft discarded");
      load();
    } catch {
      toast.error("Failed to discard draft");
    }
  };

  const counts = {
    all: drafts.length,
    draft: drafts.filter(d => d.status === "draft").length,
    confirmed: drafts.filter(d => d.status === "confirmed").length,
    discarded: drafts.filter(d => d.status === "discarded").length,
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Activity</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">Smart Add history — everything you've imported or extracted</p>
      </div>

      {!loading && drafts.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total", value: counts.all, color: "text-[#2563EB]" },
            { label: "Drafts", value: counts.draft, color: "text-[#B45309]" },
            { label: "Created", value: counts.confirmed, color: "text-[#15803D]" },
            { label: "Discarded", value: counts.discarded, color: "text-[#9CA3AF]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-64" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] py-20 text-center">
          <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-[#22C55E]" />
          </div>
          <p className="text-[#374151] font-semibold">No activity yet</p>
          <p className="text-[#9CA3AF] text-sm mt-1">Use Smart Add to upload a screenshot or import a CSV</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map(draft => (
            <DraftCard key={draft.id} draft={draft} onDiscard={() => handleDiscard(draft.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
