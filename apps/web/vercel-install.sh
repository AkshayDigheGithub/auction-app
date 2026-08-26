#!/bin/sh
# Vercel clones the whole monorepo, so npm auto-detects the root
# package.json's "workspaces" field even though the install command
# runs from apps/web (Root Directory). That puts npm in workspace mode,
# which hoists optionalDependencies platform packages (e.g.
# lightningcss-linux-x64-gnu) up to the true repo root's node_modules —
# a location lightningcss's own relative-path fallback require can never
# reach from inside apps/web/node_modules/lightningcss. Deleting the
# root package.json before installing (safe: this is a throwaway build
# container) forces a fully standalone install scoped to apps/web, so
# every dependency — including platform-specific optional ones — lands
# where the code actually expects to find it.
set -e
rm -f ../../package.json ../../package-lock.json
rm -rf node_modules package-lock.json
npm install
