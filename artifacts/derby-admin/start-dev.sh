#!/usr/bin/env bash
set -e

PORT="${PORT:-20811}"
METRO_PORT=$((PORT + 1))   # Metro interno su 20812; proxy pubblico su 20811

# ── Proxy Node.js ────────────────────────────────────────────────────────────
# • Risponde subito a /status così Replit non mostra la pagina placeholder
# • Aggiunge gli header Expo mancanti alle richieste di Expo Go
# • Fa da buffer: se Metro non è ancora pronto, aspetta fino a 90s
cat > /tmp/expo-proxy.mjs << 'PROXY_EOF'
import http from "http";

const METRO = parseInt(process.env.METRO_PORT || "20812");
const PORT  = parseInt(process.env.PROXY_PORT  || "20811");

let metroReady = false;

// Controlla periodicamente se Metro è pronto
function pollMetro() {
  const req = http.request({ hostname: "127.0.0.1", port: METRO, path: "/status", method: "GET" }, (res) => {
    let body = "";
    res.on("data", d => body += d);
    res.on("end", () => {
      if (body.includes("packager-status:running")) {
        if (!metroReady) console.log("[proxy] Metro pronto.");
        metroReady = true;
      }
    });
  });
  req.on("error", () => {});
  req.end();
}
setInterval(pollMetro, 1000);
pollMetro();

// Attende che Metro sia pronto (max 90s)
function waitForMetro(cb) {
  if (metroReady) return cb();
  let elapsed = 0;
  const t = setInterval(() => {
    elapsed += 500;
    if (metroReady) { clearInterval(t); return cb(); }
    if (elapsed > 90000) { clearInterval(t); return cb(); } // timeout, prova comunque
  }, 500);
}

function proxyToMetro(req, res) {
  // Aggiungi header Expo se mancanti
  if (!req.headers["expo-platform"] && !req.headers["exponent-platform"]) {
    req.headers["expo-platform"]     = "ios";
    req.headers["exponent-platform"] = "ios";
  }
  if (!req.headers["expo-sdk-version"]) {
    req.headers["expo-sdk-version"] = "54.0.0";
  }
  // Metro sceglie il manifest Expo in base all'header Accept. Alcune
  // richieste iniziali di Expo Go arrivano con Accept: */*, quindi forza
  // esplicitamente il formato del manifest per la richiesta di avvio.
  if (req.url === "/" && !req.headers["accept"]?.includes("application/expo+json")) {
    req.headers["accept"] = "application/expo+json,application/json";
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
}

const server = http.createServer((req, res) => {
  // Health-check: risponde subito senza aspettare Metro
  if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("packager-status:running");
    return;
  }

  // Per tutte le altre richieste, aspetta che Metro sia pronto
  waitForMetro(() => proxyToMetro(req, res));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] Expo proxy attivo su :${PORT} → Metro :${METRO}`);
});
PROXY_EOF

# ── Avvia prima il proxy (così Replit vede subito /status) ───────────────────
PROXY_PORT="${PORT}" METRO_PORT="${METRO_PORT}" node /tmp/expo-proxy.mjs &
PROXY_PID=$!

# ── Metro ────────────────────────────────────────────────────────────────────
EXPO_PACKAGER_PROXY_URL="https://${REPLIT_EXPO_DEV_DOMAIN}" \
EXPO_PUBLIC_DOMAIN="${REPLIT_DEV_DOMAIN}" \
EXPO_PUBLIC_REPL_ID="${REPL_ID}" \
REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_EXPO_DEV_DOMAIN}" \
pnpm exec expo start --localhost --port "${METRO_PORT}" &

METRO_PID=$!

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
