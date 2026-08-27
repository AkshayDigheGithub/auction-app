#!/bin/sh
# Same workaround as apps/web/vercel-install.sh, and for the same reason.
#
# Vercel clones the whole monorepo, so npm sees the root package.json's
# "workspaces" field even though this install runs from apps/site (Root
# Directory). That puts npm in workspace mode, which hoists platform-specific
# optionalDependencies — notably lightningcss-linux-x64-gnu, pulled in by
# Tailwind v4 — up to the true repo root's node_modules, where lightningcss's
# own relative-path fallback require can never find them from inside
# apps/site/node_modules/lightningcss.
#
# Deleting the root package.json first (safe: throwaway build container) forces
# a standalone install scoped to apps/site.
#
# Note this app is deliberately NOT the PWA: no serwist, no service worker.
set -e
rm -f ../../package.json ../../package-lock.json
rm -rf node_modules package-lock.json
npm install
