import { useState } from "react";
import {
  useGetDeals, useCreateDeal, useCreatePayment, useCreateExpense,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { incomeTypeLabel } from "@/lib/format";
import { QUERY_KEYS, DASHBOARD_KEYS } from "@/lib/queryKeys";
import { X } from "lucide-react";
import { toast } from "sonner";

const INCOME_TYPES = ["brand_collab", "ugc", "affiliate", "platform_payout", "retainer", "subscription", "barter", "other"];
const EXPENSE_CATEGORIES = [
  { value: "production", label: "Shoot / Production" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "manager_commission", label: "Manager Commission" },
  { value: "equipment", label: "Equipment" },
  { value: "editing", label: "Editing" },
  { value: "ads", label: "Ads" },
  { value: "freelancers", label: "Freelancers" },
  { value: "other", label: "Other" },
];

function Overlay({ onClick }: { onClick: () => void }) {
  return <div className="fixed inset-0 bg-black/40 z-40" onClick={onClick} />;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <Overlay onClick={onClose} />
      <div
        className="fixed z-50 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">
          {children}
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-500 mb-1.5">{children}</label>;
}

function TextInput({ placeholder, value, onChange, autoFocus }: {
  placeholder?: string; value: string; onChange: (v: string) => void; autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-colors border border-transparent focus:border-blue-200"
    />
  );
}

function RupeeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg border border-transparent focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-white focus-within:border-blue-200 transition-colors">
      <span className="pl-4 pr-1 text-gray-500 text-sm font-medium select-none">₹</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        className="flex-1 bg-transparent py-3 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
      />
    </div>
  );
}

function SelectInput({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white focus:border-blue-200 border border-transparent transition-colors appearance-none cursor-pointer"
    >
      {children}
    </select>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white focus:border-blue-200 border border-transparent transition-colors"
    />
  );
}

function SaveBtn({ loading, label = "Save" }: { loading?: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors mt-5"
    >
      {loading ? "Saving..." : label}
    </button>
  );
}

export function QuickAddDealModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createDeal = useCreateDeal();

  const [brandName, setBrandName] = useState("");
  const [amount, setAmount] = useState("");
  const [incomeType, setIncomeType] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) { setError("Brand / Client is required"); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("Deal Amount is required"); return; }
    setError("");
    setLoading(true);
    try {
      await createDeal.mutateAsync({
        data: {
          brandName,
          campaignName: campaignName || brandName,
          incomeType: incomeType || "brand_collab",
          amountAgreed: amount,
          currency: "INR",
          isBarter: false,
          barterEstimatedValue: null,
          startDate: startDate || null,
          dueDate: dueDate || null,
          notes: null,
        }
      });
      toast.success("Deal added successfully");
      await invalidateAll();
      onClose();
    } catch {
      setError("Failed to save deal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Add New Deal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <Label>Brand / Client</Label>
          <TextInput value={brandName} onChange={setBrandName} placeholder="e.g. Boat Lifestyle" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Deal Amount</Label>
            <RupeeInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <Label>Type</Label>
            <SelectInput value={incomeType} onChange={setIncomeType}>
              <option value="">Select</option>
              {INCOME_TYPES.map(t => <option key={t} value={t}>{incomeTypeLabel(t)}</option>)}
            </SelectInput>
          </div>
        </div>
        <div>
          <Label>What's the deliverable?</Label>
          <TextInput value={campaignName} onChange={setCampaignName} placeholder="e.g. 2 Reels + 1 YouTube video" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <DateInput value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <Label>Payment Due</Label>
            <DateInput value={dueDate} onChange={setDueDate} />
          </div>
        </div>
        <SaveBtn loading={loading} />
      </form>
    </ModalShell>
  );
}

export function QuickAddPaymentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createPayment = useCreatePayment();
  const { data: deals } = useGetDeals({}, { query: { queryKey: QUERY_KEYS.deals } });

  const [dealId, setDealId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.deals });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setError("Amount is required"); return; }
    setError("");
    setLoading(true);
    try {
      await createPayment.mutateAsync({
        data: {
          dealId: dealId ? parseInt(dealId) : null,
          amountReceived: amount,
          currency: "INR",
          paymentMethod: "bank_transfer",
          receivedDate: date,
          notes: note || null,
        }
      });
      toast.success("Payment recorded");
      await invalidateAll();
      onClose();
    } catch {
      setError("Failed to record payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const dealOptions = (deals ?? []).filter(d => d.status !== "paid" && d.status !== "cancelled");

  return (
    <ModalShell title="Record Payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <Label>Which deal?</Label>
          <SelectInput value={dealId} onChange={setDealId}>
            <option value="">Select deal</option>
            {dealOptions.map(d => (
              <option key={d.id} value={String(d.id)}>
                {d.brandName} — {d.campaignName}
              </option>
            ))}
            {(deals ?? []).filter(d => d.status === "paid" || d.status === "cancelled").map(d => (
              <option key={d.id} value={String(d.id)}>
                {d.brandName} — {d.campaignName}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount Received</Label>
            <RupeeInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <Label>Date</Label>
            <DateInput value={date} onChange={setDate} />
          </div>
        </div>
        <div>
          <Label>Note</Label>
          <TextInput value={note} onChange={setNote} placeholder="e.g. Advance — 50%" />
        </div>
        <SaveBtn loading={loading} />
      </form>
    </ModalShell>
  );
}

export function QuickAddExpenseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createExpense = useCreateExpense();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
    for (const key of DASHBOARD_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Description is required"); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("Amount is required"); return; }
    setError("");
    setLoading(true);
    try {
      await createExpense.mutateAsync({
        data: {
          dealId: null,
          title,
          category: category || "other",
          amount,
          currency: "INR",
          expenseDate: date,
          notes: null,
        }
      });
      toast.success("Expense added");
      await invalidateAll();
      onClose();
    } catch {
      setError("Failed to save expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Add Expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <Label>What did you spend on?</Label>
          <TextInput value={title} onChange={setTitle} placeholder="e.g. Camera operator for shoot" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <RupeeInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <Label>Category</Label>
            <SelectInput value={category} onChange={setCategory}>
              <option value="">Select</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectInput>
          </div>
        </div>
        <div>
          <Label>Date</Label>
          <DateInput value={date} onChange={setDate} />
        </div>
        <SaveBtn loading={loading} />
      </form>
    </ModalShell>
  );
}
