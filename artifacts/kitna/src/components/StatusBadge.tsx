interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid:            { label: "Paid",        className: "bg-[#F0FDF4] text-[#15803D] border border-[#22C55E]/20" },
  partially_paid:  { label: "Partial",     className: "bg-amber-50 text-amber-700 border border-amber-200" },
  overdue:         { label: "Overdue",     className: "bg-red-50 text-[#EF4444] border border-red-200" },
  pending_payment: { label: "Pending",     className: "bg-amber-50 text-amber-700 border border-amber-200" },
  active:          { label: "Active",      className: "bg-blue-50 text-[#2563EB] border border-blue-200" },
  draft:           { label: "Draft",       className: "bg-[#F8FAFC] text-[#6B7280] border border-[#E5E7EB]" },
  cancelled:       { label: "Cancelled",   className: "bg-[#F8FAFC] text-[#9CA3AF] border border-[#E5E7EB] line-through" },
  barter:          { label: "Barter",      className: "bg-amber-50/60 text-amber-600 border border-amber-200" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-[#F8FAFC] text-[#6B7280] border border-[#E5E7EB]" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}
