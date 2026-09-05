"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resetGoogleSignIn } from "./google-signin";

export type Role = "customer" | "shop_owner" | "admin";

export interface AuthUser {
  sub: string;
  /** Null for a Google sign-in that has given no phone number yet (AUC-85). */
  phoneNumber: string | null;
  /** Null for a phone/OTP sign-in. */
  email: string | null;
  role: Role;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        localStorage.removeItem("auth");
      }
    }
    setReady(true);
  }, []);

  function login(token: string, user: AuthUser) {
    localStorage.setItem("auth", JSON.stringify({ token, user }));
    setToken(token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem("auth");
    setToken(null);
    setUser(null);
    // Otherwise Google re-offers the account that just signed out, which on a
    // shared phone signs the next person straight back in as the last one.
    resetGoogleSignIn();
  }

  return <AuthContext.Provider value={{ token, user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
