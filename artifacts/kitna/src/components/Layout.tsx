import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Handshake,
  CreditCard,
  Receipt,
  TrendingUp,
  Clock,
  Activity,
  Settings,
  LogOut,
  IndianRupee,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { SmartAddModal } from "./SmartAddModal";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/profit", label: "Profit", icon: TrendingUp },
  { href: "/receivables", label: "Receivables", icon: Clock },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [smartAddOpen, setSmartAddOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0F172A] flex flex-col shrink-0">

        {/* Brand lockup */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-7 h-7 bg-[#22C55E] rounded-lg flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-lg tracking-tight leading-none">kitna</span>
          </div>
          <p className="text-[#22C55E]/60 text-[11px] font-normal tracking-wide ml-[37px] leading-none">(actual bana?)</p>
        </div>

        {/* Smart Add button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => setSmartAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-lg shadow-green-900/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Smart Add
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-px overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-[#94A3B8] hover:text-white hover:bg-white/[0.05]"
                }`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#22C55E]" : ""}`} />
                  {label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#22C55E]" />}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 pb-4 pt-3 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 bg-[#22C55E]/20 rounded-full flex items-center justify-center text-[#22C55E] text-xs font-bold uppercase shrink-0">
              {user?.name?.charAt(0) ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-[#64748B] text-[10px] capitalize truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 w-full text-[#64748B] hover:text-white hover:bg-white/[0.05] rounded-lg text-xs transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        {children}
      </main>

      {smartAddOpen && <SmartAddModal onClose={() => setSmartAddOpen(false)} />}
    </div>
  );
}
