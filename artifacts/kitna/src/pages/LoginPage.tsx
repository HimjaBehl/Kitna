import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { IndianRupee } from "lucide-react";

export function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-11 h-11 bg-[#22C55E] rounded-xl flex items-center justify-center mb-5 shadow-lg shadow-green-900/40">
            <IndianRupee className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-white text-2xl font-bold tracking-tight leading-none">kitna</p>
          <p className="text-[#22C55E]/70 text-[13px] font-medium mt-1 tracking-wide">actual bana?</p>
          <p className="text-[#475569] text-xs mt-3 text-center">Money clarity for creators and managers</p>
        </div>

        {/* Card */}
        <div className="bg-[#1E293B]/80 backdrop-blur rounded-2xl border border-white/[0.07] p-7">
          <h2 className="text-white font-bold text-lg mb-6">Sign in</h2>

          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#FCA5A5] text-sm px-4 py-2.5 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-[#0F172A] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22C55E]/40 focus:ring-1 focus:ring-[#22C55E]/20 placeholder-[#334155] transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-[#0F172A] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22C55E]/40 focus:ring-1 focus:ring-[#22C55E]/20 placeholder-[#334155] transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2 shadow-md shadow-green-900/30"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-[#475569] text-xs text-center mt-5">
            No account?{" "}
            <a
              href="/signup"
              onClick={e => { e.preventDefault(); navigate("/signup"); }}
              className="text-[#22C55E] hover:text-[#4ADE80] font-semibold transition-colors"
            >
              Sign up
            </a>
          </p>
        </div>

        <p className="text-[#1E293B] text-[11px] text-center mt-6">Demo: demo@kitna.app / demo1234</p>
      </div>
    </div>
  );
}
