/**
 * Google Identity Services, "Sign in with Google" (https://accounts.google.com/gsi/client).
 *
 * Deliberately the *rendered button* + credential-callback flow, not an OAuth
 * redirect. The app is installed as a PWA with `display: "standalone"`
 * (see app/manifest.ts), and a full-page OAuth redirect launched from a
 * standalone window can hand the user off to the system browser and never come
 * back — leaving them signed in somewhere they cannot see. This flow never
 * navigates the page: Google returns the ID token straight to a callback.
 *
 * What comes back is an ID token, which the backend redeems for the verified
 * email address. Our API never sees a password and never trusts an address the
 * browser typed — see GoogleAuthService on the API side.
 */

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

/**
 * Whether to offer Google sign-in at all. Unset locally, so development can
 * keep the OTP flow and needs no Google Cloud project.
 */
export const GOOGLE_SIGNIN_ENABLED = Boolean(GOOGLE_CLIENT_ID);

interface CredentialResponse {
  /** The ID token — a JWT signed by Google. */
  credential?: string;
}

interface GoogleIdApi {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
}

/**
 * Google Maps and Google Identity Services both hang off `window.google` —
 * Maps at `.maps`, sign-in at `.accounts`. lib/google-maps.ts already declares
 * that global as the Maps SDK, so widening it here collides with that
 * declaration. Reading through a local cast keeps the two SDKs' typings from
 * fighting over a global neither of them owns.
 */
function googleIdApi(): GoogleIdApi | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleIdApi } } }).google
    ?.accounts?.id;
}

/**
 * The handler the current login screen wants called. Google's `initialize`
 * takes one callback for the life of the page, so it delegates here instead of
 * being re-initialised on every React render — re-initialising mid-session
 * tears down the rendered button.
 */
let onCredential: ((idToken: string) => void) | null = null;

let loader: Promise<void> | null = null;

/** Loads and initialises the library once per page, reusing the same promise. */
function load(): Promise<void> {
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error("Google sign-in is not configured"));
      return;
    }

    if (googleIdApi()) return resolve();

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const api = googleIdApi();
      if (!api) {
        loader = null;
        reject(new Error("Could not load Google sign-in"));
        return;
      }
      api.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (res: CredentialResponse) => {
          if (res.credential) onCredential?.(res.credential);
        },
        // Popup rather than redirect, for the standalone-PWA reason above.
        ux_mode: "popup",
        // No One Tap auto-select: the user picks a role before signing in, so
        // silently resuming the last account would skip that choice.
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      resolve();
    };
    script.onerror = () => {
      loader = null; // let a later attempt retry rather than fail forever
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });

  return loader;
}

/**
 * Draws Google's own button into `parent` and routes the resulting ID token to
 * `handler`. Google requires its rendered button — a custom one is not allowed
 * to trigger this flow — so the login screen hands over a container element.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  handler: (idToken: string) => void,
): Promise<void> {
  await load();
  onCredential = handler;

  const api = googleIdApi();
  if (!api) throw new Error("Google sign-in is unavailable");

  parent.replaceChildren();
  api.renderButton(parent, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    logo_alignment: "center",
    width: Math.min(parent.clientWidth || 320, 400),
  });
}

/**
 * Forgets the handler and stops Google offering the last account on the next
 * visit. Called on logout so a shared phone — common enough among the shop
 * owners this is aimed at — does not sign the next person straight back in.
 */
export function resetGoogleSignIn(): void {
  onCredential = null;
  googleIdApi()?.disableAutoSelect();
}
