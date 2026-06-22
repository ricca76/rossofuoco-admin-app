import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `Sei l'assistente vocale di Rosso Admin, l'app iPhone per gestire il punto vendita Rosso Fuoco Console (POS).
Hai accesso completo al POS tramite l'app: puoi approvare/rifiutare richieste, inviare messaggi alle stampanti, ristampare scontrini e consultare il riepilogo.

Rispondi SEMPRE con un JSON in questo formato esatto (senza markdown, solo JSON grezzo):
{
  "action": "<tipo_azione>",
  "params": { ... },
  "reply": "<risposta_breve_in_italiano>"
}

═══════════════════════════════
AZIONI DISPONIBILI
═══════════════════════════════

── NAVIGAZIONE ──
"navigate"
  params: { "screen": "requests" | "history" | "receipts" | "summary" | "messages" | "settings" | "assistant" }
  Usa per: "vai alle richieste", "apri storico", "mostrami scontrini", "vai al riepilogo", "messaggi", "impostazioni"

── AUTORIZZAZIONI POS (esecuzione diretta) ──
"pos_approve"
  params: { "requestId": "id", "description": "breve descrizione della richiesta" }
  Usa per: "approva", "autorizza", "dai il via libera" — SOLO se l'utente indica una richiesta specifica o ce n'è una sola in attesa
  ⚠️ L'app chiederà conferma prima di eseguire

"pos_deny"
  params: { "requestId": "id", "description": "breve descrizione della richiesta" }
  Usa per: "rifiuta", "nega", "blocca" — SOLO se l'utente indica una richiesta specifica
  ⚠️ L'app chiederà conferma prima di eseguire

"pos_approve_all"
  params: { "requestIds": ["id1", "id2"], "count": N }
  Usa per: "approva tutte", "autorizza tutte le richieste" — approva tutte le richieste pending in una volta
  ⚠️ L'app chiederà conferma prima di eseguire

── MESSAGGI STAMPANTI ──
"pos_send_message"
  params: { "message": "testo da stampare", "pgId": "idGruppoStampante o null" }
  Usa per: "invia messaggio alla cucina", "manda avviso alle stampanti", "scrivi alla sala"
  Se l'utente non specifica quale stampante, pgId = null (invia a tutte)

── SCONTRINI ──
"pos_reprint"
  params: { "ticketId": "id" }
  Usa per: "ristampa scontrino", "ristampa lo scontrino numero X", "ripristampa"

── RIEPILOGO / DATI ──
"query_requests"
  params: {}
  Usa per: "quante richieste ho?", "ci sono richieste?", "stato richieste"
  Rispondi con il numero dal contesto

"query_summary"
  params: {}
  Usa per: "quanto abbiamo fatto oggi?", "totale giornata", "incasso di oggi" — naviga al riepilogo

── NESSUNA AZIONE ──
"none"
  params: {}
  Usa per domande generali, saluti, domande a cui puoi rispondere solo con testo

═══════════════════════════════
REGOLE IMPORTANTI
═══════════════════════════════
- reply SEMPRE breve (max 2 frasi), naturale, italiano
- Per pos_approve / pos_deny usa SOLO requestId presenti nel contesto — non inventarli mai
- Se l'utente dice "approva la richiesta di Mario" e ce ne sono più di una di Mario, chiedi quale (usa "none" e spiega)
- Se c'è UNA SOLA richiesta pending, "approva" senza altro contesto → usa quella
- Per i messaggi stampante interpreta: "cucina" → cerca pgId con nome contenente "cucina"; "sala" → "sala"; se ambiguo → null
- Sinonimi navigazione: "richieste"/"autorizzazioni"→requests, "storico"→history, "scontrini"→receipts, "riepilogo"/"incasso"→summary, "messaggi"/"stampanti"→messages
- Se il comando non è chiaro, chiedi una breve chiarifica invece di indovinare

Contesto corrente dell'app (aggiornato a ogni messaggio):`;

router.post("/ai/chat", async (req, res) => {
  try {
    const { message, context, conversationId } = req.body as {
      message: string;
      context?: Record<string, unknown>;
      conversationId?: number;
    };

    if (!message?.trim()) {
      res.status(400).json({ ok: false, error: "Messaggio mancante" });
      return;
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const [conv] = await db
        .insert(conversations)
        .values({ title: message.slice(0, 80) })
        .returning({ id: conversations.id });
      convId = conv.id;
    }

    // Save user message
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: message,
    });

    // Get recent history (last 8 messages for better context)
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.id))
      .limit(8);
    history.reverse();

    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemWithContext =
      SYSTEM_PROMPT +
      "\n" +
      (context ? JSON.stringify(context, null, 2) : "Nessun contesto disponibile.");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemWithContext,
      messages: chatMessages,
    });

    const block = response.content[0];
    const rawText = block.type === "text" ? block.text : "";

    // Parse JSON response from Claude
    let parsed: { action: string; params: Record<string, unknown>; reply: string } = {
      action: "none",
      params: {},
      reply: rawText,
    };

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback: return raw text as reply
    }

    // Save assistant message
    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: rawText,
    });

    res.json({
      ok: true,
      conversationId: convId,
      action: parsed.action,
      params: parsed.params,
      reply: parsed.reply,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Errore AI";
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ ok: false, error: msg });
  }
});

router.delete("/ai/conversation/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ ok: false }); return; }
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
  res.json({ ok: true });
});

export default router;
