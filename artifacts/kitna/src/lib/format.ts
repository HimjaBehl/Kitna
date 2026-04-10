export function formatCurrency(amount: string | number, currency = "INR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function incomeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    brand_collab: "Brand Collab",
    ugc: "UGC",
    affiliate: "Affiliate",
    platform_payout: "Platform Payout",
    retainer: "Retainer",
    subscription: "Subscription",
    barter: "Barter",
    other: "Other",
  };
  return map[type] ?? type;
}

export function expenseCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    editing: "Editing",
    production: "Production",
    travel: "Travel",
    styling: "Styling",
    props: "Props",
    ads: "Ads",
    software: "Software",
    equipment: "Equipment",
    freelancers: "Freelancers",
    manager_commission: "Manager Commission",
    tax: "Tax",
    other: "Other",
  };
  return map[cat] ?? cat;
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    upi: "UPI",
    platform_payout: "Platform Payout",
    gateway: "Gateway",
    cash: "Cash",
    other: "Other",
  };
  return map[method] ?? method;
}
