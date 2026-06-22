---
name: Expo Font Metro Crash
description: Metro crasha con ENOENT watch su expo-font_tmp_* dopo installazioni parziali di pacchetti
---

**Rule:** Dopo `pnpm add` di pacchetti Expo che fallisce a metà, Metro può crashare con `ENOENT: no such file or directory, watch .../expo-font_tmp_NNNN/android/src`.

**Why:** pnpm lascia cartelle temporanee corrotte in `.pnpm/expo-font*/node_modules/expo-font_tmp_*` che Metro prova a osservare ma non esistono più.

**How to apply:** Se Metro crasha con questo errore, eseguire:
```
rm -rf /home/runner/workspace/node_modules/.pnpm/expo-font*/node_modules/expo-font_tmp_*
pnpm --filter @workspace/derby-admin install --no-frozen-lockfile
```
Poi riavviare il workflow Expo.
