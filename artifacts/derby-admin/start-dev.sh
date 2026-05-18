#!/usr/bin/env bash
set -e

PORT="${PORT:-20811}"

# Start Expo Metro in the background
EXPO_PACKAGER_PROXY_URL="https://${REPLIT_EXPO_DEV_DOMAIN}" \
EXPO_PUBLIC_DOMAIN="${REPLIT_DEV_DOMAIN}" \
EXPO_PUBLIC_REPL_ID="${REPL_ID}" \
REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_EXPO_DEV_DOMAIN}" \
pnpm exec expo start --localhost --port "${PORT}" &

METRO_PID=$!

# Pre-warm: wait for Metro then compile iOS bundle in background
(
  echo "[prewarm] Attendo Metro sulla porta ${PORT}..."
  for i in $(seq 1 90); do
    if curl -sf "http://localhost:${PORT}/status" 2>/dev/null | grep -q "packager-status:running"; then
      echo "[prewarm] Metro pronto. Avvio precompilazione bundle iOS..."

      MANIFEST=$(curl -sf "http://localhost:${PORT}/?platform=ios&dev=true" 2>/dev/null || echo "")
      if [ -z "$MANIFEST" ]; then
        echo "[prewarm] Manifest non disponibile, esco."
        break
      fi

      BUNDLE_URL=$(echo "$MANIFEST" | node -e "
        let d = '';
        process.stdin.on('data', c => d += c);
        process.stdin.on('end', () => {
          try {
            const m = JSON.parse(d);
            const url = (m.launchAsset && m.launchAsset.url) || '';
            const local = url.replace(/https:\/\/[^/]+/, 'http://localhost:${PORT}');
            console.log(local);
          } catch(e) { process.exit(1); }
        });
      " 2>/dev/null || echo "")

      if [ -n "$BUNDLE_URL" ]; then
        echo "[prewarm] Compilazione bundle iOS in corso (può richiedere 60-90s)..."
        if curl -sf --max-time 180 "$BUNDLE_URL" -o /dev/null 2>/dev/null; then
          echo "[prewarm] Bundle iOS pronto — Expo Go si connetterà senza errori 404."
        else
          echo "[prewarm] Precompilazione terminata (non critico)."
        fi
      else
        echo "[prewarm] URL bundle non trovato nel manifest."
      fi
      break
    fi
    sleep 2
  done
) &

wait "${METRO_PID}"
