#!/bin/sh
rm -rf node_modules package-lock.json
npm install --loglevel verbose 2>&1 | grep -i "lightningcss-linux" | head -30
echo "--- exit code above was for grep, now real install ---"
npm install 2>&1 | tail -5
