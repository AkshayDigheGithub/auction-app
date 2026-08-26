#!/bin/sh
echo "--- npm config optional ---"
npm config get optional
echo "--- env vars ---"
env | grep -i "npm_config\|NPM_CONFIG" || echo "none"
rm -rf node_modules package-lock.json
npm install --include=optional 2>&1 | tail -10
echo "--- lightningcss check ---"
ls node_modules | grep lightningcss || echo "none found"
