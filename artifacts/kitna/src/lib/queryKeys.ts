export const QUERY_KEYS = {
  deals: ["/api/deals"],
  payments: ["/api/payments"],
  expenses: ["/api/expenses"],
  dashboardSummary: ["/api/dashboard/summary"],
  monthlyTrend: ["/api/dashboard/monthly-trend"],
  incomeByType: ["/api/dashboard/income-by-type"],
  recentActivity: ["/api/dashboard/recent-activity"],
  receivables: ["/api/receivables"],
  profit: ["/api/profit"],
} as const;

export const DASHBOARD_KEYS = [
  QUERY_KEYS.dashboardSummary,
  QUERY_KEYS.monthlyTrend,
  QUERY_KEYS.incomeByType,
  QUERY_KEYS.recentActivity,
  QUERY_KEYS.receivables,
  QUERY_KEYS.profit,
];
