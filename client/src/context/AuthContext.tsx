import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type UserRole = "guest" | "agent";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** true immediately after agent registers — banner should be shown */
  pendingVerification: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Call after the user clicks the verify link so the UI updates instantly */
  markVerified: () => void;
  error: string | null;
  clearError: () => void;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);

  // Fetch current session on mount
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setUser(data);
        // If they were registered as an agent and haven't verified yet
        if (data?.role === "agent" && !data?.emailVerified) {
          setPendingVerification(true);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Erreur de connexion");
    setUser(data);
    // Show banner if agent logs in while still unverified
    if (data?.role === "agent" && !data?.emailVerified) {
      setPendingVerification(true);
    }
  }, []);

  const register = useCallback(async (form: RegisterData) => {
    setError(null);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Erreur d'inscription");
    setUser(data);
    if (data.pendingVerification) {
      setPendingVerification(true);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setPendingVerification(false);
  }, []);

  const resendVerification = useCallback(async () => {
    const r = await fetch("/api/auth/resend-verification", {
      method: "POST",
      credentials: "include",
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Erreur lors de l'envoi");
  }, []);

  const markVerified = useCallback(() => {
    setUser((u) => (u ? { ...u, emailVerified: true } : u));
    setPendingVerification(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pendingVerification,
        login,
        register,
        logout,
        resendVerification,
        markVerified,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
