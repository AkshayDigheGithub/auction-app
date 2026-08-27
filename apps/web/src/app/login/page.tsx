"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  MSG91_WIDGET_ENABLED,
  retryWidgetOtp,
  sendWidgetOtp,
  verifyWidgetOtp,
} from "@/lib/msg91-widget";
import { useAuth, type Role } from "@/lib/auth-context";
import { ErrorBanner, InfoBanner, inputClass, labelClass, primaryButtonClass, Spinner } from "@/components/ui";

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
      if (MSG91_WIDGET_ENABLED) {
        // MSG91 generates and sends the code; our API is not involved until
        // there is an access token to redeem.
        await sendWidgetOtp(phoneNumber);
        setDevCode(null);
      } else {
        const res = await api.post<{ devCode?: string }>("/auth/otp/request", { phoneNumber });
        setDevCode(res.devCode ?? null);
      }
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      if (MSG91_WIDGET_ENABLED) await retryWidgetOtp();
      else await api.post("/auth/otp/request", { phoneNumber });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      type AuthResponse = { token: string; user: { id: string; phoneNumber: string; role: Role } };
      let res: AuthResponse;

      if (MSG91_WIDGET_ENABLED) {
        // Deliberately no phone number in this call. The API takes it from
        // MSG91's verification of the access token, so a tampered client
        // cannot claim a number it has not proven.
        const accessToken = await verifyWidgetOtp(code);
        res = await api.post<AuthResponse>("/auth/widget/verify", { accessToken, role });
      } else {
        res = await api.post<AuthResponse>("/auth/otp/verify", { phoneNumber, code, role });
      }

      login(res.token, { sub: res.user.id, phoneNumber: res.user.phoneNumber, role: res.user.role });
      router.push(ROLE_HOME[res.user.role] ?? "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Signing in as</p>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{ROLE_LABEL[role] ?? role}</h1>
      </div>

      {step === "phone" ? (
        <form onSubmit={requestOtp} className="flex flex-col gap-4">
          <label className={labelClass}>
            Phone number
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919876543210"
              className={inputClass}
            />
          </label>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Sending…" : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="flex flex-col gap-4">
          {devCode && (
            <InfoBanner tone="amber">
              Dev mode — no SMS gateway configured. Your code is <strong>{devCode}</strong>.
            </InfoBanner>
          )}
          <label className={labelClass}>
            Enter the 6-digit code
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className={`${inputClass} tracking-[0.4em] text-center`}
            />
          </label>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Verifying…" : "Verify & continue"}
          </button>
          <div className="flex justify-between gap-4 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="text-neutral-400 underline decoration-dotted underline-offset-2 dark:text-neutral-500"
            >
              Use a different number
            </button>
            <button
              type="button"
              onClick={resend}
              className="text-neutral-400 underline decoration-dotted underline-offset-2 dark:text-neutral-500"
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      <Link
        href="/"
        className="text-center text-xs text-neutral-400 underline decoration-dotted underline-offset-2 dark:text-neutral-500"
      >
        Not {ROLE_LABEL[role]?.toLowerCase() ?? "this role"}? Go back
      </Link>
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
