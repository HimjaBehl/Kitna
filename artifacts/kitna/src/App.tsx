import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken } from "@/lib/api";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DealsPage } from "@/pages/DealsPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { ExpensesPage } from "@/pages/ExpensesPage";
import { ReceivablesPage } from "@/pages/ReceivablesPage";
import { ProfitPage } from "@/pages/ProfitPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { CompliancePage } from "@/pages/CompliancePage";

setAuthTokenGetter(() => getToken());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/"><Redirect to="/dashboard" /></Route>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/deals" component={DealsPage} />
        <Route path="/payments" component={PaymentsPage} />
        <Route path="/expenses" component={ExpensesPage} />
        <Route path="/receivables" component={ReceivablesPage} />
        <Route path="/profit" component={ProfitPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/compliance" component={CompliancePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route><Redirect to="/dashboard" /></Route>
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </WouterRouter>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}

export default App;
