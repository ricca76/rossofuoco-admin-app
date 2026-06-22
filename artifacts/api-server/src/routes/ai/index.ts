import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `Sei l'assistente vocale di Rosso Admin, l'app per gestire le autorizzazioni del punto vendita Rosso Fuoco Console (POS).

Il tuo compito è interpretare i comandi vocali dell'amministratore e rispondere in modo conciso e utile in italiano.

CONTESTO POS:
- Il POS gestisce ordini, conti, autorizzazioni
- L'admin può approvare/rifiutare richieste, inviare messaggi stampanti, consultare scontrini e riepilogo giornaliero

COMANDI CHE PUOI INTERPRETARE:
Rispondi SEMPRE con un JSON nel seguente formato:
{
  "action": "<tipo_azione>",
  "params": { ... },
  "reply": "<risposta_vocale_breve_in_italiano>"
}

Tipi di azione disponibili:
- "navigate": navigare a una schermata. params: { "screen": "requests"|"history"|"receipts"|"summary"|"messages"|"settings" }
- "approve_request": approvare una richiesta. params: { "requestId": "id" } — usa solo se l'utente nomina una richiesta specifica
- "deny_request": rifiutare una richiesta. params: { "requestId": "id" }
- "send_message": inviare messaggio alle stampanti. params: { "message": "testo" }
- "query_summary": chiedere info sul riepilogo. params: {}
- "query_requests": chiedere quante richieste in attesa. params: {}
- "none": nessuna azione specifica, solo risposta informativa. params: {}

REGOLE:
- reply deve essere SEMPRE breve (max 2 frasi), in italiano, naturale
- Se il comando è ambiguo, chiedi chiarimento
- Se l'utente chiede "quante richieste" e hai il contesto, rispondi con il numero
- Per la navigazione, interpreta sinonimi: "vai alle richieste" = navigate requests, "mostrami lo storico" = navigate history, "apri scontrini" = navigate receipts, "riepilogo" = navigate summary, "messaggi" o "stampante" = navigate messages
- Non inventare requestId — usa solo quelli che ti vengono forniti nel contesto

Contesto corrente dell'app fornito dall'utente (può essere vuoto):`;

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

    // Get recent history (last 6 messages)
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.id))
      .limit(6);
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
      // fallback: return raw text
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
