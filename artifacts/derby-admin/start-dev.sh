#!/usr/bin/env bash
set -e

PORT="${PORT:-20811}"
METRO_PORT=$((PORT + 1))   # Metro interno su 20812; proxy pubblico su 20811

# ── Proxy Node.js ────────────────────────────────────────────────────────────
# Il proxy aggiunge automaticamente gli header Expo che alcune versioni di
# Expo Go omettono, evitando che Metro risponda con la pagina HTML placeholder.
cat > /tmp/expo-proxy.mjs << 'PROXY_EOF'
import http from "http";

const METRO = parseInt(process.env.METRO_PORT || "20812");
const PORT  = parseInt(process.env.PROXY_PORT  || "20811");

const server = http.createServer((req, res) => {
  // Aggiungi header Expo se mancanti (necessario per ottenere il manifest JSON)
  if (!req.headers["expo-platform"] && !req.headers["exponent-platform"]) {
    req.headers["expo-platform"]     = "ios";
    req.headers["exponent-platform"] = "ios";
  }
  if (!req.headers["expo-sdk-version"]) {
    req.headers["expo-sdk-version"] = "54.0.0";
  }

  const options = {
    hostname: "127.0.0.1",
    port: METRO,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (metroRes) => {
    res.writeHead(metroRes.statusCode, metroRes.headers);
    metroRes.pipe(res, { end: true });
  });

  proxy.on("error", (err) => {
    res.writeHead(502);
    res.end("Metro non raggiungibile: " + err.message);
  });

  req.pipe(proxy, { end: true });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] Expo proxy attivo su :${PORT} → Metro :${METRO}`);
});
PROXY_EOF

# ── Metro ────────────────────────────────────────────────────────────────────
EXPO_PACKAGER_PROXY_URL="https://${REPLIT_EXPO_DEV_DOMAIN}" \
EXPO_PUBLIC_DOMAIN="${REPLIT_DEV_DOMAIN}" \
EXPO_PUBLIC_REPL_ID="${REPL_ID}" \
REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_EXPO_DEV_DOMAIN}" \
pnpm exec expo start --localhost --port "${METRO_PORT}" &

METRO_PID=$!

# ── Proxy ────────────────────────────────────────────────────────────────────
PROXY_PORT="${PORT}" METRO_PORT="${METRO_PORT}" node /tmp/expo-proxy.mjs &
PROXY_PID=$!

# ── Pre-warm ─────────────────────────────────────────────────────────────────
(
  echo "[prewarm] Attendo Metro sulla porta ${METRO_PORT}..."
  for i in $(seq 1 90); do
    if curl -sf "http://localhost:${METRO_PORT}/status" 2>/dev/null | grep -q "packager-status:running"; then
      echo "[prewarm] Metro pronto. Avvio precompilazione bundle iOS..."

      MANIFEST=$(curl -sf \
        -H "exponent-platform: ios" \
        -H "Accept: application/expo+json" \
        "http://localhost:${METRO_PORT}/?platform=ios&dev=true" 2>/dev/null || echo "")

      if [ -z "$MANIFEST" ]; then
        echo "[prewarm] Manifest non disponibile, skip."
        break
      fi

      BUNDLE_URL=$(echo "$MANIFEST" | node -e "
        let d = '';
        process.stdin.on('data', c => d += c);
        process.stdin.on('end', () => {
          try {
            const m = JSON.parse(d);
            const url = (m.launchAsset && m.launchAsset.url) || '';
            const local = url.replace(/https:\/\/[^/]+/, 'http://localhost:${METRO_PORT}');
            console.log(local);
          } catch(e) { process.exit(1); }
        });
      " 2>/dev/null || echo "")

      if [ -n "$BUNDLE_URL" ]; then
        echo "[prewarm] Compilazione bundle iOS in corso..."
        curl -sf --max-time 180 "$BUNDLE_URL" -o /dev/null 2>/dev/null && \
          echo "[prewarm] Bundle iOS pronto." || \
          echo "[prewarm] Precompilazione terminata (non critico)."
      fi
      break
    fi
    sleep 2
  done
) &

wait "${METRO_PID}"
kill "${PROXY_PID}" 2>/dev/null || true
