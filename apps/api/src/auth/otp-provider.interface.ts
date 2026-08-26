export interface OtpProvider {
  /** Deliver a one-time code to a phone number. */
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');
