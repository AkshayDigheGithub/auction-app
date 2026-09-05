"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  MSG91_WIDGET_ENABLED,
  retryWidgetOtp,
  sendWidgetOtp,
  verifyWidgetOtp,
} from "@/lib/msg91-widget";
import { GOOGLE_SIGNIN_ENABLED, renderGoogleButton } from "@/lib/google-signin";
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

type AuthResponse = {
  token: string;
  user: { id: string; phoneNumber: string | null; email: string | null; role: Role };
};

/**
 * Phone OTP is parked rather than removed (AUC-85): it stays reachable so the
 * SMS path can be re-enabled or A/B tested without a revert. It is also the
 * automatic fallback wherever Google is not configured, which keeps local
 * development working with no Google Cloud project.
 */
const OTP_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_OTP_LOGIN === "true" || !GOOGLE_SIGNIN_ENABLED;

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const role = (useSearchParams().get("role") ?? "customer") as Role;

  const [step, setStep] = useState<"choose" | "phone" | "code">(
    GOOGLE_SIGNIN_ENABLED ? "choose" : "phone",
  );
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  function finishLogin(res: AuthResponse) {
    login(res.token, {
      sub: res.user.id,
      phoneNumber: res.user.phoneNumber,
      email: res.user.email,
      role: res.user.role,
    });
    router.push(ROLE_HOME[res.user.role] ?? "/");
  }

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      setError(null);
      setLoading(true);
      try {
        // Deliberately no email in this call. The API takes it from Google's
        // verification of the ID token, so a tampered client cannot claim an
        // address it has not proven.
        const res = await api.post<AuthResponse>("/auth/google/verify", { idToken, role });
        finishLogin(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : (err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    // finishLogin closes over router/login, both stable for this screen's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role],
  );

  useEffect(() => {
    if (step !== "choose" || !GOOGLE_SIGNIN_ENABLED) return;
    const el = googleButtonRef.current;
    if (!el) return;

    let cancelled = false;
    renderGoogleButton(el, (idToken) => {
      if (!cancelled) void signInWithGoogle(idToken);
    }).catch((err: unknown) => {
      if (!cancelled) setError((err as Error).message);
    });

    return () => {
      cancelled = true;
    };
  }, [step, signInWithGoogle]);

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
      if (MSG91_WIDGET_ENABLED) {
        await retryWidgetOtp();
      } else {
        // Refresh the dev banner as well — a resend replaces the code the API
        // is holding, so leaving the old one on screen guarantees a rejection.
        const res = await api.post<{ devCode?: string }>("/auth/otp/request", { phoneNumber });
        setDevCode(res.devCode ?? null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
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

      finishLogin(res);
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

      {step === "choose" && (
        <div className="flex flex-col gap-4">
          {/* Google requires its own rendered button; this is the container. */}
          <div ref={googleButtonRef} className="flex min-h-[44px] justify-center" />

          {loading && (
            <p className="flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <Spinner className="h-4 w-4" />
              Signing you in…
            </p>
          )}

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {OTP_LOGIN_ENABLED && (
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="text-center text-sm text-neutral-400 underline decoration-dotted underline-offset-2 dark:text-neutral-500"
            >
              Use your phone number instead
            </button>
          )}
        </div>
      )}

      {step === "phone" && (
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
          {GOOGLE_SIGNIN_ENABLED && (
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setError(null);
              }}
              className="text-center text-sm text-neutral-400 underline decoration-dotted underline-offset-2 dark:text-neutral-500"
            >
              Back to Google sign-in
            </button>
          )}
        </form>
      )}

      {step === "code" && (
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
