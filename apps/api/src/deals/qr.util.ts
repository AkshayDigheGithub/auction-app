import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 48 * 60 * 60 * 1000; // 48h — long enough for the customer to visit the shop.

function secret(): string {
  return process.env.QR_SIGNING_SECRET || 'dev-only-change-me-too';
}

/** Signed, tamper-proof token: dealId + timestamp + HMAC signature (AUC-25). */
export function signQrToken(dealId: string): string {
  const ts = Date.now();
  const payload = `${dealId}.${ts}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Verifies signature + expiry, returns the dealId. Throws on any tamper/expiry (AUC-27). */
export function verifyQrToken(token: string): { dealId: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed QR token');

  const [dealId, tsStr, sig] = parts;
  const payload = `${dealId}.${tsStr}`;
  const expectedSig = createHmac('sha256', secret()).update(payload).digest('hex');

  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid QR signature');
  }

  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) {
    throw new Error('QR token expired');
  }

  return { dealId };
}
