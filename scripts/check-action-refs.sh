#!/bin/sh
# Setelah `npm run build`: cari referensi tak terdefinisi di server action hasil build
# (bug `pid is not defined`: lolos tsc/dev, 500 hanya di produksi). Keluar 1 bila ada.
# ponytail: global browser dari pustaka klien (xlsx dll.) diabaikan lewat daftar; tambah bila muncul false positive.
set -e
cd "$(dirname "$0")/.."
cat > .audit-eslint.tmp.mjs <<'JS'
const g = Object.fromEntries("require module exports process Buffer console URL URLSearchParams fetch Request Response Headers FormData File Blob TextEncoder TextDecoder setTimeout clearTimeout setInterval Promise crypto AbortController ReadableStream WritableStream TransformStream global globalThis structuredClone atob btoa performance queueMicrotask __dirname __filename".split(" ").map(k=>[k,"readonly"]));
export default [{ files: ["**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: g }, rules: { "no-undef": "error" } }];
JS
trap 'rm -f .audit-eslint.tmp.mjs' EXIT
FILES=$(grep -l decryptActionBoundArgs -r .next/server/app --include=page.js)
OUT=$(ESLINT_USE_FLAT_CONFIG=true npx eslint --no-config-lookup -c .audit-eslint.tmp.mjs $FILES 2>&1 | grep no-undef | grep -vE "'(localStorage|DataTransfer|Deno|IE_SaveFile|navigator|saveAs|document|chrome|getComputedStyle|decrypt_[a-z0-9]+)'" || true)
[ -z "$OUT" ] || { echo "$OUT"; exit 1; }
echo "ok: $(echo "$FILES" | wc -w) halaman dengan server action bersih"
