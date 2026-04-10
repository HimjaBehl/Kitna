import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { IndianRupee } from "lucide-react";

export function SignupPage() {
  const [, navigate] = useLocation();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("creator");
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(name, email, password, role, currency);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
            <IndianRupee className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white">Kitna</h1>
          <p className="text-gray-400 text-sm mt-1">Money clarity for creators</p>
        </div>

        <div className="bg-[#1E293B] rounded-2xl p-6 border border-white/10">
          <h2 className="text-white font-semibold text-lg mb-5">Create account</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-[#0F172A] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 placeholder-gray-600"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#0F172A] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 placeholder-gray-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-[#0F172A] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 placeholder-gray-600"
                placeholder="Min. 6 characters"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-[#0F172A] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500/50"
                >
                  <option value="creator">Creator</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-[#0F172A] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500/50"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-gray-500 text-xs text-center mt-4">
            Already have an account?{" "}
            <a href="/login" onClick={e => { e.preventDefault(); navigate("/login"); }} className="text-green-400 hover:text-green-300">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
