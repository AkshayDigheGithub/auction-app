"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth, type Role } from "@/lib/auth-context";

const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  shop_owner: "Shop Owner",
  admin: "Admin",
};

const ROLE_HOME: Record<string, string> = {
  customer: "/request/new",
  shop_owner: "/onboard",
  admin: "/admin",
};

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const role = (useSearchParams().get("role") ?? "customer") as Role;

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ devCode?: string }>("/auth/otp/request", { phoneNumber });
      setDevCode(res.devCode ?? null);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: string; phoneNumber: string; role: Role } }>(
        "/auth/otp/verify",
        { phoneNumber, code, role },
      );
      login(res.token, { sub: res.user.id, phoneNumber: res.user.phoneNumber, role: res.user.role });
      router.push(ROLE_HOME[res.user.role] ?? "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm text-neutral-500">Signing in as</p>
        <h1 className="text-xl font-bold">{ROLE_LABEL[role] ?? role}</h1>
      </div>

      {step === "phone" ? (
        <form onSubmit={requestOtp} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Phone number
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919876543210"
              className="rounded-lg border border-neutral-300 px-3 py-3 text-base"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-orange-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="flex flex-col gap-4">
          {devCode && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Dev mode — no SMS gateway configured. Your code is <strong>{devCode}</strong>.
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Enter the 6-digit code
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="rounded-lg border border-neutral-300 px-3 py-3 text-base tracking-widest"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-orange-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & continue"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
