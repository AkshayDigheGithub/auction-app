#!/bin/sh
set -x
rm -rf node_modules package-lock.json
npm install --libc=glibc
echo "--- DEBUG lightningcss ---"
ls node_modules | grep lightningcss || echo "no lightningcss packages found"
