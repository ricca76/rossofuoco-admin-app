---
name: AI Assistant Routing
description: Come è cablato l'assistente vocale Claude nell'app Rosso Admin
---

**Rule:** L'assistente vocale usa Replit AI Integrations per Anthropic (nessuna chiave API richiesta all'utente). La route è `POST /api/ai/chat` sull'API server Replit (non sul POS).

**Why:** Il POS non ha endpoint AI — tutta la logica AI gira sul backend Replit che poi dice all'app quali azioni eseguire sul POS.

**How to apply:**
- Backend: `artifacts/api-server/src/routes/ai/index.ts` — riceve testo + contesto app, chiama Claude, restituisce `{ action, params, reply }`
- Frontend: `artifacts/derby-admin/app/(main)/assistant.tsx` — tab "Assistente", usa `expo-speech-recognition` per trascrizione nativa iOS, poi fetch `/api/ai/chat`
- Claude risponde sempre con JSON `{ action, params, reply }` — l'app esegue l'azione (navigazione, apertura richiesta, ecc.)
- Conversazioni persistite in tabelle `conversations` + `messages` (PostgreSQL via Drizzle)
- env vars: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (auto-set da Replit)
