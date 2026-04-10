import { useState } from "react";
import { useGetExpenses, useGetDeals, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, expenseCategoryLabel } from "@/lib/format";
import { QUERY_KEYS, DASHBOARD_KEYS } from "@/lib/queryKeys";
import { Plus, Pencil, Trash2, X, Receipt } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["editing", "production", "travel", "styling", "props", "ads", "software", "equipment", "freelancers", "manager_commission", "tax", "other"];

function inp(extra = "") { return `w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/20 placeholder:text-[#9CA3AF] transition-colors ${extra}`; }
function lbl() { return "text-xs font-semibold text-[#6B7280] uppercase tracking-wide block mb-1.5"; }

function ExpenseModal({ expense, onClose }: { expense?: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { data: deals } = useGetDeals({}, { query: { queryKey: QUERY_KEYS.deals } });
  const isEdit = !!expense;

  const [form, setForm] = useState(() => expense ? {
    dealId: expense.dealId != null ? String(expense.dealId) : "",
    title: (expense.title as string) ?? "",
    category: (expense.category as string) ?? "other",
    amount: (expense.amount as string) ?? "",
    currency: (expense.currency as string) ?? "INR",
    expenseDate: expense.expenseDate ? new Date(expense.expenseDate as string).toISOString().split("T")[0] : "",
    notes: (expense.notes as string) ?? "",
    isRecurring: (expense.isRecurring as boolean) ?? false,
    recurringFrequency: (expense.recurringFrequency as string) ?? "",
    vendorOrPayee: (expense.vendorOrPayee as string) ?? "",
  } : { dealId: "", title: "", category: "other", amount: "", currency: "INR", expenseDate: new Date().toISOString().split("T")[0], notes: "", isRecurring: false, recurringFrequency: "", vendorOrPayee: "" });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const payload = {
        dealId: form.dealId ? parseInt(form.dealId) : null,
        title: form.title, category: form.category, amount: form.amount,
        currency: form.currency, expenseDate: form.expenseDate, notes: form.notes || null,
        isRecurring: form.isRecurring,
        recurringFrequency: form.recurringFrequency || null,
        vendorOrPayee: form.vendorOrPayee || null,
      };
      if (isEdit) { await updateExpense.mutateAsync({ id: expense.id as number, data: payload }); toast.success("Expense updated"); }
      else { await createExpense.mutateAsync({ data: payload }); toast.success("Expense added"); }
      await invalidateAll(); onClose();
    } catch { setError("Failed to save expense"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <h2 className="font-bold text-[#111827] text-lg">{isEdit ? "Edit Expense" : "Add Expense"}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-[#EF4444] text-sm">{error}</p>}
          <div>
            <label className={lbl()}>What did you spend on? *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} required className={inp()} placeholder="e.g. Camera operator for shoot" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl()}>Amount *</label>
              <div className="flex items-center bg-gray-50 border border-[#E5E7EB] rounded-xl focus-within:border-[#22C55E] focus-within:ring-1 focus-within:ring-[#22C55E]/20 transition-colors">
                <span className="pl-4 pr-1 text-[#9CA3AF] text-sm font-medium select-none">₹</span>
                <input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} required placeholder="5000" className="flex-1 bg-transparent py-2.5 pr-4 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
              </div>
            </div>
            <div>
              <label className={lbl()}>Category *</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className={inp("bg-gray-50")}>
                {CATEGORIES.map(c => <option key={c} value={c}>{expenseCategoryLabel(c)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl()}>Date *</label>
            <input type="date" value={form.expenseDate} onChange={e => set("expenseDate", e.target.value)} required className={inp()} />
          </div>
          <div>
            <label className={lbl()}>Paid to <span className="text-[#D1D5DB] normal-case font-normal">(vendor / payee)</span></label>
            <input value={form.vendorOrPayee} onChange={e => set("vendorOrPayee", e.target.value)} className={inp()} placeholder="e.g. Freelancer name, software company" />
          </div>
          <div>
            <label className={lbl()}>Link to Deal <span className="text-[#D1D5DB] normal-case font-normal">(optional)</span></label>
            <select value={form.dealId} onChange={e => set("dealId", e.target.value)} className={inp("bg-gray-50")}>
              <option value="">Not linked to a deal</option>
              {(deals ?? []).map(d => <option key={d.id} value={String(d.id)}>{d.brandName} — {d.campaignName}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 py-1">
            <input type="checkbox" id="isRecurring" checked={form.isRecurring} onChange={e => set("isRecurring", e.target.checked)} className="rounded accent-[#22C55E]" />
            <label htmlFor="isRecurring" className="text-sm text-[#374151]">This is a recurring cost</label>
          </div>
          {form.isRecurring && (
            <div>
              <label className={lbl()}>How often?</label>
              <select value={form.recurringFrequency} onChange={e => set("recurringFrequency", e.target.value)} className={inp("bg-gray-50")}>
                <option value="">Select frequency</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}
          <div>
            <label className={lbl()}>Notes</label>
            <input value={form.notes} onChange={e => set("notes", e.target.value)} className={inp()} placeholder="Any extra context" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] text-[#6B7280] rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">{loading ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExpensesPage() {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Record<string, unknown> | null>(null);

  const params = categoryFilter ? { category: categoryFilter } : {};
  const { data: expenses, isLoading } = useGetExpenses(params, { query: { queryKey: [...QUERY_KEYS.expenses, params] } });
  const deleteExpense = useDeleteExpense();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this expense?")) return;
    await deleteExpense.mutateAsync({ id });
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
    toast.success("Expense deleted");
  };

  const total = (expenses ?? []).reduce((s, e) => s + parseFloat(e.amount ?? "0"), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Expenses</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">What you spent to earn what you earned</p>
        </div>
        <button onClick={() => { setEditExpense(null); setShowModal(true); }} className="flex items-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-green-200">
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Add Expense
        </button>
      </div>

      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-[#E5E7EB] bg-white rounded-xl px-3.5 py-2 text-sm text-[#374151] focus:outline-none focus:border-[#22C55E] cursor-pointer">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{expenseCategoryLabel(c)}</option>)}
        </select>
        {!isLoading && (expenses ?? []).length > 0 && (
          <p className="text-xs text-[#9CA3AF] ml-auto">
            {(expenses ?? []).length} item{(expenses ?? []).length !== 1 ? "s" : ""} &middot; Total <span className="font-bold text-[#EF4444]">-{formatCurrency(total, "INR")}</span>
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#F8FAFC]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="h-3.5 bg-gray-200 rounded w-20" />
                <div className="flex-1 space-y-2"><div className="h-3.5 bg-gray-200 rounded w-36" /><div className="h-2.5 bg-gray-100 rounded w-24" /></div>
                <div className="h-4 bg-red-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (expenses ?? []).length === 0 ? (
          <div className="py-20 text-center">
            <Receipt className="w-10 h-10 text-[#E5E7EB] mx-auto mb-3" />
            <p className="text-[#374151] font-semibold">No expenses yet</p>
            <p className="text-[#9CA3AF] text-sm mt-1">Track what you spend to see your actual profit</p>
            <button onClick={() => setShowModal(true)} className="mt-5 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-5 py-2.5 rounded-xl text-sm">+ Add Expense</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">What</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Category</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Deal</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC]">
              {(expenses ?? []).map(e => (
                <tr key={e.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3.5 text-sm text-[#9CA3AF] whitespace-nowrap">{formatDate(e.expenseDate)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-[#111827]">{e.title}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F8FAFC] text-[#6B7280] border border-[#E5E7EB] uppercase tracking-wide">
                      {expenseCategoryLabel(e.category)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#9CA3AF] hidden md:table-cell">{e.dealBrandName ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-bold text-[#EF4444]">-{formatCurrency(e.amount, e.currency)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditExpense(e as unknown as Record<string, unknown>); setShowModal(true); }} className="p-1.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F8FAFC] rounded-lg">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(showModal || editExpense) && (
        <ExpenseModal expense={editExpense ?? undefined} onClose={() => { setShowModal(false); setEditExpense(null); }} />
      )}
    </div>
  );
}
