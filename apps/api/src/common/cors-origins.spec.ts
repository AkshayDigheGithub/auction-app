import { allowedOrigins } from './cors-origins';

describe('allowedOrigins', () => {
  const original = process.env.CORS_ORIGIN;
  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = original;
  });

  it('falls back to the local dev origin when unset', () => {
    delete process.env.CORS_ORIGIN;
    expect(allowedOrigins()).toEqual(['http://localhost:3000']);
  });

  it('accepts a single origin unchanged', () => {
    process.env.CORS_ORIGIN = 'https://app.example.com';
    expect(allowedOrigins()).toEqual(['https://app.example.com']);
  });

  it('splits a comma-separated list so both frontend URLs keep working', () => {
    // The custom subdomain and the Vercel-assigned domain serve the same build;
    // allowing only one silently breaks the other's live bid feed.
    process.env.CORS_ORIGIN =
      'https://app.example.com,https://example-web.vercel.app';
    expect(allowedOrigins()).toEqual([
      'https://app.example.com',
      'https://example-web.vercel.app',
    ]);
  });

  it('tolerates spaces and trailing commas', () => {
    // Env vars get hand-edited in a dashboard; a stray space should not turn
    // into an origin that never matches.
    process.env.CORS_ORIGIN =
      ' https://a.example.com , https://b.example.com ,';
    expect(allowedOrigins()).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('falls back rather than returning an empty allowlist', () => {
    // An empty allowlist rejects every browser origin — a worse and far more
    // confusing failure than defaulting, and easy to cause by hand-editing the
    // variable in a hosting dashboard.
    process.env.CORS_ORIGIN = '   ';
    expect(allowedOrigins()).toEqual(['http://localhost:3000']);
  });

  it('falls back when the variable is empty', () => {
    process.env.CORS_ORIGIN = '';
    expect(allowedOrigins()).toEqual(['http://localhost:3000']);
  });
});
