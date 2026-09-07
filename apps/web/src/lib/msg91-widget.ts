/**
 * MSG91 "Login with OTP" widget (https://verify.msg91.com/otp-provider.js).
 *
 * Run in `exposeMethods` mode rather than letting the widget draw its own UI:
 * our login screen already carries the role the user picked and matches the
 * rest of the app, and the widget's default dialog does neither.
 *
 * With the widget, MSG91 generates, sends and checks the code — our API never
 * sees it. What comes back is a signed access token that the backend redeems
 * for the verified phone number.
 */

const SCRIPT_SRC = "https://verify.msg91.com/otp-provider.js";

export const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID;
export const MSG91_TOKEN_AUTH = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH;

/**
 * Whether to use the widget at all. Unset locally, so development keeps the
 * console-OTP flow and needs no MSG91 account.
 */
export const MSG91_WIDGET_ENABLED = Boolean(MSG91_WIDGET_ID && MSG91_TOKEN_AUTH);

type Cb = (data: unknown) => void;

interface Msg91Window extends Window {
  initSendOTP?: (config: Record<string, unknown>) => void;
  sendOtp?: (identifier: string, success: Cb, failure: Cb) => void;
  verifyOtp?: (otp: string | number, success: Cb, failure: Cb) => void;
  retryOtp?: (channel: string, success: Cb, failure: Cb) => void;
}

let loader: Promise<void> | null = null;

/** Loads and initialises the widget once per page, reusing the same promise. */
function load(): Promise<void> {
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const w = window as Msg91Window;
    if (w.sendOtp) return resolve();

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      w.initSendOTP?.({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: true,
        // Success and failure are required by the widget but unused in
        // exposeMethods mode — each call passes its own callbacks.
        success: () => {},
        failure: () => {},
      });
      resolve();
    };
    script.onerror = () => {
      loader = null; // let a later attempt retry rather than fail forever
      reject(new Error("Could not load the OTP service"));
    };
    document.head.appendChild(script);
  });

  return loader;
}

/**
 * MSG91 wants the country code with no `+` (`919876543210`); the app stores
 * and displays E.164 (`+919876543210`).
 */
function toMsg91Identifier(phoneNumber: string): string {
  return phoneNumber.replace(/[^\d]/g, "");
}

/** Turns the widget's untyped failure argument into something readable. */
function toMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const m = (err as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export async function sendWidgetOtp(phoneNumber: string): Promise<void> {
  await load();
  const w = window as Msg91Window;
  return new Promise((resolve, reject) => {
    if (!w.sendOtp) return reject(new Error("OTP service unavailable"));
    w.sendOtp(
      toMsg91Identifier(phoneNumber),
      () => resolve(),
      (err) => reject(new Error(toMessage(err, "Could not send the code"))),
    );
  });
}

/** @returns the access token to hand to our API for verification. */
export async function verifyWidgetOtp(code: string): Promise<string> {
  await load();
  const w = window as Msg91Window;
  return new Promise((resolve, reject) => {
    if (!w.verifyOtp) return reject(new Error("OTP service unavailable"));
    w.verifyOtp(
      code,
      (data) => {
        const token =
          data && typeof data === "object"
            ? ((data as Record<string, unknown>).message ??
              (data as Record<string, unknown>).accessToken)
            : data;
        if (typeof token !== "string" || token.length < 20) {
          reject(new Error("Could not verify the code"));
          return;
        }
        resolve(token);
      },
      (err) => reject(new Error(toMessage(err, "Incorrect code"))),
    );
  });
}

/** Resend over SMS. MSG91 channel codes: SMS 11, voice 4, email 3, WhatsApp 12. */
export async function retryWidgetOtp(): Promise<void> {
  await load();
  const w = window as Msg91Window;
  return new Promise((resolve, reject) => {
    if (!w.retryOtp) return reject(new Error("OTP service unavailable"));
    w.retryOtp(
      "11",
      () => resolve(),
      (err) => reject(new Error(toMessage(err, "Could not resend the code"))),
    );
  });
}
