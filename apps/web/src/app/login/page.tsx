"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth as useClerkAuth, useClerk, useSignIn, useSignUp, useUser } from "@clerk/nextjs";
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
  forgetSso,
  markSsoPending,
  postSsoUrl,
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
 * Two things this screen has to get right, and got wrong before.
 *
 * First, whose sign-in to finish. The exchange is gated on
 * `consumeSsoPending()` rather than Clerk's `isSignedIn`. Keying it on the
 * latter treated "Clerk happens to hold a session" as consent to sign in, and
 * since Clerk's session cookie outlives its ~60s access token by days, that was
 * true on nearly every return visit. It meant the back button could never leave
 * /login, a phone handed over still signed in its previous owner, and logging
 * out bounced through here and collected a fresh 30-day token on the way past.
 *
 * Second, first-time users. `signIn.sso()` is strictly a sign-in: its params
 * have no `signUpIfMissing`, so a Google account with no user behind it cannot
 * complete one. Clerk normally papers over this by transferring the attempt to
 * a sign-up on its own, but that transfer is unavailable when the instance is
 * in restricted or waitlist mode — and then the callback comes back with no
 * session and the error `external_account_not_found`, which this screen used to
 * swallow entirely, leaving a working Google account staring at a button that
 * did nothing.
 *
 * So the transfer is explicit here. Coming back without a session, a sign-in
 * that Clerk marks transferable is completed with `signUp.create({ transfer })`
 * — the identity Google already verified, carried over without a second round
 * trip. The mirror case is handled too: someone who took the "create an
 * account" path but already had one transfers back the other way. Only when
 * neither applies do we ask for a fresh `signUp.sso()`.
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
  const { signUp } = useSignUp();
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  /**
   * What this mount is doing about the Clerk state it found.
   *
   * - `idle` — nothing in flight; offer to sign in.
   * - `resuming` — a session we are entitled to; exchange it for one of ours.
   * - `confirm` — a session we did not just create; name it and ask first.
   * - `transferring` — the OAuth identity is verified but the account on our
   *   side still has to be created (or matched); no second trip to Google.
   * - `no-account` — came back with nothing usable; offer an explicit sign-up.
   */
  const [phase, setPhase] = useState<
    "idle" | "resuming" | "confirm" | "transferring" | "no-account"
  >("idle");
  const [starting, setStarting] = useState(false);
  const [switching, setSwitching] = useState(false);

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
        // The role the user actually picked, parked in storage so it survives
        // the OAuth round trip; `?role=` in the URL is the fallback, and the
        // return URL now carries it for exactly that reason.
        role: recallRole() ?? role,
      });
      forgetRole();
      onSession(res);
    } catch (err) {
      inFlight.current = false;
      // The Clerk session is still live, so drop back to the explicit button
      // rather than leaving a dead screen with only an error on it.
      setPhase("confirm");
      onError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }, [getToken, role, onSession, onError]);

  // Rules once on whatever came back, and only after Clerk has settled —
  // `isSignedIn` is false while it is still hydrating, and deciding on that
  // would read every returning user as a stranger.
  useEffect(() => {
    if (!isLoaded) return;
    void (async () => {
      if (decided.current) return;
      decided.current = true;

      // A pending marker means this browser started the redirect that just
      // came back, so finishing it is what the user already asked for.
      // Anything else is a pre-existing session and has to be confirmed.
      const invited = consumeSsoPending();

      if (isSignedIn) {
        setPhase(invited ? "resuming" : "confirm");
        return;
      }
      // An ordinary first visit: no session, nothing in flight.
      if (!invited) return;

      // Back from Google with no session. Usually this Google account has no
      // user on our side yet — which is a sign-up, not a failure.
      if (signIn?.isTransferable || signUp?.isTransferable) setPhase("transferring");
      else setPhase("no-account");
    })();
  }, [isLoaded, isSignedIn, signIn, signUp]);

  // Carries a verified OAuth identity across to whichever resource can finish
  // it. Clerk sets exactly one of these when an attempt cannot complete on its
  // own, so the direction is read from Clerk rather than assumed.
  useEffect(() => {
    if (phase !== "transferring") return;
    void (async () => {
      if (!signIn || !signUp) return;
      const { error } = signIn.isTransferable
        ? await signUp.create({ transfer: true })
        : await signIn.create({ transfer: true });

      if (error) {
        onError(error.message || "Could not finish setting up your account");
        setPhase("no-account");
        return;
      }
      // A session exists now (or is about to). The effect below waits for
      // Clerk to publish it rather than racing getToken() against it.
      setPhase("resuming");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "resuming" || !isSignedIn) return;
    void (async () => {
      await runExchange();
    })();
  }, [phase, isSignedIn, runExchange]);

  /** Shared by both entry points — only the resource driving it differs. */
  async function beginSso(kind: "sign-in" | "sign-up") {
    const resource = kind === "sign-in" ? signIn : signUp;
    if (!resource) return;
    onError(null);
    setStarting(true);

    // Both survive the trip to Google and back; the URL's ?role= does not.
    rememberRole(role);
    markSsoPending();

    try {
      // Two different destinations, and they are not interchangeable.
      //
      // `redirectUrl` is where a *completed* sign-in lands, and it has to be
      // this screen: /login is the only place that exchanges a Clerk session
      // for one of our tokens. Both were previously set to /sso-callback, which
      // named no destination at all for the completed case — so Clerk fell
      // through to its own chain and, at the end of it, to a default of "/".
      // That is the marketing landing page: signed in with Clerk, signed out of
      // the app, and asked to pick a role and start over.
      //
      // `redirectCallbackUrl` is the other case — no session, more information
      // needed — and that is what /sso-callback is for. It hands back here too,
      // where the transfer below can finish the job.
      //
      // Absolute, not bare paths: sso() parses these with the URL constructor.
      // See ssoCallbackUrl() for why the origin is read off the window.
      const { error } = await resource.sso({
        strategy: "oauth_google",
        redirectUrl: postSsoUrl(role),
        redirectCallbackUrl: ssoCallbackUrl(),
      });
      // Only reached if the handshake failed — on success the browser has
      // already navigated away.
      if (error) {
        forgetSso();
        onError(error.message || "Could not continue with Google");
        setStarting(false);
      }
    } catch (err) {
      forgetSso();
      onError(err instanceof Error ? err.message : "Could not continue with Google");
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
      setPhase("idle");
    } catch {
      onError("Could not switch accounts. Check your connection and try again.");
    } finally {
      setSwitching(false);
    }
  }

  if (phase === "transferring") {
    return (
      <button type="button" disabled className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
        <Spinner className="h-4 w-4" />
        Setting up your account…
      </button>
    );
  }

  // Deliberately spinner-first for a live session: on the path that matters —
  // coming back from Google — showing the confirm button for the frame before
  // the decision lands would offer a tap the user has already made.
  if (isSignedIn && phase !== "confirm" && !switching) {
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
            setPhase("resuming");
            onError(null);
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

  // Google verified the account but there is nobody behind it here, and Clerk
  // offered no transfer to carry it over. Say so, and offer the sign-up
  // outright rather than the same button that just failed.
  if (phase === "no-account") {
    return (
      <div className="flex flex-col gap-3">
        <InfoBanner tone="amber">
          No account here yet for that Google account.
        </InfoBanner>
        <button
          type="button"
          onClick={() => void beginSso("sign-up")}
          disabled={starting}
          className={`${primaryButtonClass} flex items-center justify-center gap-2`}
        >
          {starting && <Spinner className="h-4 w-4" />}
          {starting ? "Opening Google…" : "Create your account with Google"}
        </button>
        <button
          type="button"
          onClick={() => void beginSso("sign-in")}
          disabled={starting}
          className={`${secondaryButtonClass} flex items-center justify-center gap-2`}
        >
          Try signing in again
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void beginSso("sign-in")}
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
