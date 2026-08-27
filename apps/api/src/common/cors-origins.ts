const DEFAULT_ORIGIN = 'http://localhost:3000';

/**
 * Browser origins allowed to call the API, parsed from a comma-separated
 * `CORS_ORIGIN`.
 *
 * A list rather than a single origin because the frontend is reachable at more
 * than one address at a time: the Vercel-assigned `*.vercel.app` domain and the
 * custom subdomain both serve the same build, and anyone still using the older
 * URL has to keep working. Narrowing to one origin breaks the other **without
 * an error anyone sees** — the REST calls fail in the browser console and the
 * Socket.io bid feed just stops updating, which reads as "the app is broken"
 * rather than "CORS is misconfigured".
 *
 * Both `app.enableCors` and Socket.io's `cors` option accept a string array
 * directly, so this is shared verbatim by the HTTP server and the gateway.
 *
 * @example CORS_ORIGIN="https://app.example.com,https://example-web.vercel.app"
 */
export function allowedOrigins(): string[] {
  const parsed = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // A set variable that parses to nothing — whitespace, a stray comma — would
  // otherwise produce an empty allowlist, which rejects *every* browser origin.
  // That is a worse and much more confusing failure than falling back, and it
  // is an easy thing to do by hand in a hosting dashboard.
  return parsed.length > 0 ? parsed : [DEFAULT_ORIGIN];
}
