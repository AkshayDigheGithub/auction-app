import type { NextConfig } from "next";

/**
 * The marketing site is deliberately a separate app from apps/web.
 *
 * apps/web registers a service worker at the origin root; if the marketing
 * pages were served from that same origin they would be cached by it, and
 * visitors would be served stale marketing copy from an offline cache they
 * never asked for. Keeping them apart also means a copy change does not
 * rebuild or redeploy the product.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
