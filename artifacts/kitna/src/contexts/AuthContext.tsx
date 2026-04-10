import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch, setToken, clearToken, getToken } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  currency: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: string, currency: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/auth/me");
      if (res.ok) {
        setUser(await res.json());
      } else {
        clearToken();
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMe(); }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Login failed");
    }
    const d = await res.json();
    setToken(d.token);
    setUser(d.user);
  };

  const signup = async (name: string, email: string, password: string, role: string, currency: string) => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role, currency }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Signup failed");
    }
    const d = await res.json();
    setToken(d.token);
    setUser(d.user);
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await apiFetch("/auth/me");
    if (res.ok) setUser(await res.json());
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
