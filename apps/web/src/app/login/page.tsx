"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth as useClerkAuth, useClerk, useSignIn, useUser } from "@clerk/nextjs";
import { api, ApiError } from "@/lib/api";
import {
  MSG91_WIDGET_ENABLED,
  retryWidgetOtp,
  sendWidgetOtp,
  verifyWidgetOtp,
} from "@/lib/msg91-widget";
import {
  CLERK_ENABLED,
  consumeSsoPending,
  forgetRole,
  markSsoPending,
  recallRole,
  rememberRole,
  ssoCallbackUrl,
} from "@/lib/clerk";
import { useAuth, type Role } from "@/lib/auth-context";
import { homeForRole } from "@/lib/role-routes";
import {
  ErrorBanner,
  InfoBanner,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  Spinner,
} from "@/components/ui";

const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  shop_owner: "Shop Owner",
  admin: "Admin",
};

type AuthResponse = {
  token: string;
  user: { id: string; phoneNumber: string | null; email: string | null; role: Role };
};

/**
 * Phone OTP is parked rather than removed (AUC-85): it stays reachable so the
 * SMS path can be re-enabled or A/B tested without a revert. It is also the
 * automatic fallback wherever Clerk is not configured, which keeps local
 * development working with no Clerk account.
 */
const OTP_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_OTP_LOGIN === "true" || !CLERK_ENABLED;

/**
 * Clerk sign-in, with Google as the only enabled provider.
 *
 * Rendered only when CLERK_ENABLED, because Clerk's hooks throw outside the
 * ClerkProvider that the same constant gates in app/layout.tsx.
 *
 * The exchange is deliberately gated on `consumeSsoPending()` rather than on
 * Clerk's `isSignedIn`. Keying it on the latter treated "Clerk happens to hold
 * a session" as consent to sign in, and since Clerk's session cookie outlives
 * its ~60s access token by days, that was true on nearly every return visit to
 * this page. It meant the back button could never leave /login, a phone handed
 * over still signed in its previous owner, and logging out bounced through here
 * and collected a fresh 30-day token on the way past.
 *
 * So: finish automatically only what this browser just started, and make every
 * other path an explicit tap.
 */
function ClerkSignIn({
  role,
  onSession,
  onError,
}: {
  role: Role;
  onSession: (res: AuthResponse) => void;
  onError: (message: string | null) => void;
}) {
  const { signIn, fetchStatus } = useSignIn();
  const { isSignedIn, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const [starting, setStarting] = useState(false);
  const [switching, setSwitching] = useState(false);
  // A Clerk session we did not just create, or one whose exchange failed.
  // Either way it takes a tap before it becomes one of our sessions, so the
  // account being resumed is always on screen before it is resumed.
  const [needsConfirm, setNeedsConfirm] = useState(false);

  // Clerk's hooks re-render on their own schedule; without these a second
  // render mid-request would post the token twice, or rule on the session
  // twice and undo the first answer.
  const inFlight = useRef(false);
  const decided = useRef(false);

  const runExchange = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const sessionToken = await getToken();
      if (!sessionToken) throw new Error("Could not read your sign-in");
      // Deliberately no email in this call. The API resolves it from Clerk,
      // so a tampered client cannot claim an address it has not proven.
      const res = await api.post<AuthResponse>("/auth/clerk/verify", {
        sessionToken,
        // The role the user actually picked, which survives the OAuth round
        // trip in sessionStorage; `role` from the URL is the fallback.
        role: recallRole() ?? role,
      });
      forgetRole();
      onSession(res);
    } catch (err) {
      inFlight.current = false;
      // The Clerk session is still live, so drop back to the explicit button
      // rather than leaving a dead screen with only an error on it.
      setNeedsConfirm(true);
      onError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }, [getToken, role, onSession, onError]);

  useEffect(() => {
    if (!isSignedIn) return;
    void (async () => {
      if (decided.current) return;
      decided.current = true;
      // Only ever resume a sign-in this browser started. A session that merely
      // happens to exist is not consent — it is usually just whoever used the
      // phone last — so anything else has to be confirmed by tapping.
      if (consumeSsoPending()) await runExchange();
      else setNeedsConfirm(true);
    })();
  }, [isSignedIn, runExchange]);

  async function start() {
    if (!signIn) return;
    onError(null);
    setStarting(true);

    // Both survive the trip to Google and back; the URL's ?role= does not.
    rememberRole(role);
    markSsoPending();

    try {
      // Absolute, not a bare path — sso() parses these with the URL
      // constructor. See ssoCallbackUrl() for why.
      const callback = ssoCallbackUrl();
      const { error } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: callback,
        redirectCallbackUrl: callback,
      });
      // Only reached if the handshake failed — on success the browser has
      // already navigated away.
      if (error) {
        consumeSsoPending();
        onError(error.message || "Could not sign in with Google");
        setStarting(false);
      }
    } catch (err) {
      consumeSsoPending();
      onError(err instanceof Error ? err.message : "Could not sign in with Google");
      setStarting(false);
    }
  }

  /**
   * The way out when the session on screen belongs to someone else — the shared
   * phone this whole flow is built around. Without it, "Continue as …" would be
   * the only offer and the previous owner's account the only reachable one.
   */
  async function switchAccount() {
    setSwitching(true);
    onError(null);
    try {
      await signOut();
      decided.current = false;
      setNeedsConfirm(false);
    } catch {
      onError("Could not switch accounts. Check your connection and try again.");
    } finally {
      setSwitching(false);
    }
  }

  // Deliberately spinner-first for a live session: on the path that matters —
  // coming back from Google — showing the confirm button for the frame before
  // the decision lands would offer a tap the user has already made.
  if (isSignedIn && !needsConfirm && !switching) {
    return (
      <button type="button" disabled className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
        <Spinner className="h-4 w-4" />
        Signing you in…
      </button>
    );
  }

  // A live Clerk session we did not just create: show whose it is, and make
  // continuing a deliberate act.
  if (isSignedIn) {
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setNeedsConfirm(false);
            onError(null);
            void runExchange();
          }}
          disabled={switching}
          className={`${primaryButtonClass} flex items-center justify-center gap-2`}
        >
          {email ? `Continue as ${email}` : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => void switchAccount()}
          disabled={switching}
          className={`${secondaryButtonClass} flex items-center justify-center gap-2`}
        >
          {switching && <Spinner className="h-4 w-4" />}
          {switching ? "Switching…" : "Use a different account"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={fetchStatus === "fetching" || starting}
      className={`${primaryButtonClass} flex items-center justify-center gap-2`}
    >
      {starting && <Spinner className="h-4 w-4" />}
      {starting ? "Signing you in…" : "Continue with Google"}
    </button>
  );
}

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const role = (useSearchParams().get("role") ?? "customer") as Role;

  const [step, setStep] = useState<"choose" | "phone" | "code">(
    CLERK_ENABLED ? "choose" : "phone",
  );
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const finishLogin = useCallback(
    (res: AuthResponse) => {
      login(res.token, {
        sub: res.user.id,
        phoneNumber: res.user.phoneNumber,
        email: res.user.email,
        role: res.user.role,
      });
      // replace(), not push(): /login is not a place to go back to. Leaving it
      // in the history stack meant a back tap remounted it, found the live
      // Clerk session and pushed straight forward again — an inescapable loop
      // that minted a token per bounce.
      router.replace(homeForRole(res.user.role));
    },
    [login, router],
  );

  const showError = useCallback((message: string | null) => setError(message), []);

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
          <ClerkSignIn role={role} onSession={finishLogin} onError={showError} />

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
          {CLERK_ENABLED && (
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
