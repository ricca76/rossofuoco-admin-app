# Derby Admin

App iPhone per connettersi a Rosso Fuoco Console (Derby Server Connect) come admin e autorizzare tutte le richieste che necessitano di autorizzazione.

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
- `artifacts/derby-admin/services/derbyApi.ts` — client HTTP per Rosso Fuoco Console
- `artifacts/derby-admin/context/AuthContext.tsx` — stato autenticazione e connessione server
- `artifacts/derby-admin/context/RequestsContext.tsx` — gestione richieste di autorizzazione
- `artifacts/derby-admin/app/index.tsx` — schermata login (IP + PIN admin)
- `artifacts/derby-admin/app/(main)/requests.tsx` — lista richieste in attesa
- `artifacts/derby-admin/app/(main)/request/[id].tsx` — dettaglio e autorizzazione singola richiesta
- `artifacts/derby-admin/app/(main)/settings.tsx` — impostazioni server

## Real API (Rosso Fuoco Console — analisi dal sorgente)

Il server Rosso Fuoco Console gira sulla **porta 51521** (default locale).
**Nessun token bearer** — il server è locale sulla rete e non richiede autenticazione per la maggior parte degli endpoint.

### Endpoint usati dall'app

| Metodo | Percorso | Descrizione |
|--------|----------|-------------|
| GET | `/healthz` | Verifica raggiungibilità server |
| POST | `/users/verify-admin-pin` | Login con PIN admin → `{ pin: string }` → `{ ok, userId, name }` |
| GET | `/auth-requests` | Lista richieste in attesa → `{ requests: AuthRequest[] }` |
| POST | `/auth-requests/:id/resolve` | Approva/rifiuta → `{ approved: boolean, adminName?: string }` |
| GET | `/events/stream` | SSE per notifiche in tempo reale |

### Struttura AuthRequest

```typescript
{
  id: string,
  type: string,           // es. 'void_item', 'discount', 'refund', ...
  operatorName: string,
  operatorId: number | null,
  ticketId: string,
  tableNum: string | null,
  description: string,
  payload: Record<string, unknown>,  // dati extra (amount, price, ...)
  status: 'pending' | 'approved' | 'denied',
  createdAt: number       // Unix timestamp ms
}
```

## Architecture decisions

- Frontend-only: l'app si connette direttamente a Rosso Fuoco Console via HTTP (no backend Replit)
- IP e porta del server salvati in AsyncStorage sul dispositivo
- Login tramite PIN admin (non username/password) — `POST /users/verify-admin-pin`
- Nome admin salvato in AsyncStorage e ripristinato al riavvio (nessun token)
- Polling automatico ogni 15 secondi + SSE per aggiornamenti in tempo reale
- Porta default: 51521

## Product

- Schermata di login: inserisci IP server, porta (default 51521), e PIN admin
- Test connessione: verifica raggiungibilità tramite `/healthz` prima del login
- Dashboard richieste: lista in tempo reale delle autorizzazioni in attesa con tipo, importo, operatore
- Dettaglio richiesta: approva o rifiuta (il nome admin viene inviato con la risoluzione)
- Impostazioni: modifica configurazione server, disconnetti account

## User preferences

- App in italiano
- Connessione a Rosso Fuoco Console tramite indirizzo IP
- Autorizzazione di tutti i tipi di richieste admin

## Gotchas

- Il server usa la porta **51521** (non 8080 o altre porte comuni)
- Il login usa **PIN numerico** dell'utente admin configurato in Rosso Fuoco Console, NON username/password
- Nessun bearer token — tutte le chiamate API non richiedono autenticazione (server locale)
- Il campo `amount` può trovarsi dentro `payload.amount`, `payload.total` o `payload.price`
- I tipi reali di richiesta includono: `void_item`, `void_ticket`, `discount`, `refund`, `override`, `price_change`, `payment`, `reopen`, `delete`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
