export interface JwtPayload {
  sub: string;
  /**
   * Null for a user who signed in with Google and has given no phone number
   * (AUC-85). Nothing on the API authorises on this — guards read `sub` and
   * `role` — but it is carried so /auth/me can identify the session.
   */
  phoneNumber: string | null;
  /** Null for a user who signed in with a phone number and has no email. */
  email: string | null;
  role: 'customer' | 'shop_owner' | 'admin';
}
