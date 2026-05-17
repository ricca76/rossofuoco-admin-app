# Derby Admin

App iPhone per connettersi a Derby Server Connect come admin e autorizzare tutte le richieste che necessitano di autorizzazione.

## Run & Operate

- `pnpm --filter @workspace/derby-admin run dev` — avvia l'app Expo (mobile)
- `pnpm --filter @workspace/api-server run dev` — avvia il server API (porta 5000)
- `pnpm run typecheck` — typecheck completo su tutti i pacchetti

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) con Expo Router
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (non usato nella prima versione)
- State: React Context + AsyncStorage

## Where things live

- `artifacts/derby-admin/` — app mobile Expo
- `artifacts/derby-admin/services/derbyApi.ts` — client HTTP per Derby Server Connect
- `artifacts/derby-admin/context/AuthContext.tsx` — stato autenticazione e connessione server
- `artifacts/derby-admin/context/RequestsContext.tsx` — gestione richieste di autorizzazione
- `artifacts/derby-admin/app/index.tsx` — schermata login/connessione
- `artifacts/derby-admin/app/(main)/requests.tsx` — lista richieste in attesa
- `artifacts/derby-admin/app/(main)/request/[id].tsx` — dettaglio e autorizzazione singola richiesta
- `artifacts/derby-admin/app/(main)/settings.tsx` — impostazioni server

## Architecture decisions

- Frontend-only: l'app si connette direttamente a Derby Server Connect via HTTP (no backend Replit)
- IP e porta del server salvati in AsyncStorage sul dispositivo
- Token di autenticazione salvato in AsyncStorage e ripristinato al riavvio
- Polling automatico ogni 15 secondi per aggiornare le richieste pendenti
- API client configurabile in `services/derbyApi.ts` — adattare gli endpoint all'API reale di Derby Server Connect

## Product

- Schermata di login: inserisci IP server, porta, username e password admin
- Test connessione: verifica raggiungibilità del server prima del login
- Dashboard richieste: lista in tempo reale delle autorizzazioni in attesa con tipo, importo, operatore
- Dettaglio richiesta: approva o rifiuta con nota opzionale
- Impostazioni: modifica configurazione server, disconnetti account

## User preferences

- App in italiano
- Connessione a Derby Server Connect tramite indirizzo IP
- Autorizzazione di tutti i tipi di richieste admin

## Gotchas

- Gli endpoint API in `services/derbyApi.ts` usano pattern REST standard — verificare con la documentazione reale di Derby Server Connect e adattare se necessario
- Il token bearer viene inviato come `Authorization: Bearer <token>` — verificare il formato richiesto dal server

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
