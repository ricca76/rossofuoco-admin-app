import { Router } from "express";

const router = Router();

const LAST_UPDATED = "19 maggio 2025";
const APP_NAME = "Rosso Admin";
const COMPANY = "Rosso Fuoco";
const BUNDLE_ID = "com.rossofuoco.admin";
const CONTACT_EMAIL = "privacy@rossofuoco.it";

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — ${APP_NAME}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117; --card: #1a1d27; --border: #2a2d3a;
      --primary: #e05a3a; --primary-light: rgba(224,90,58,0.12);
      --text: #e8eaf0; --muted: #8b909e; --success: #27ae60;
      --radius: 14px; --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    body { font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.7; padding: 0 16px 80px; }
    header { text-align: center; padding: 56px 0 40px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
    .logo-wrap { display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: var(--primary-light); border: 1px solid rgba(224,90,58,0.3); border-radius: 22px; margin-bottom: 20px; }
    .logo-wrap svg { width: 42px; height: 42px; }
    h1 { font-size: clamp(26px, 5vw, 34px); font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
    .subtitle { color: var(--muted); font-size: 15px; margin-top: 6px; }
    .badge { display: inline-block; background: var(--primary-light); border: 1px solid rgba(224,90,58,0.25); color: var(--primary); font-size: 12px; font-weight: 600; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 20px; margin-top: 14px; text-transform: uppercase; }
    .container { max-width: 780px; margin: 0 auto; }
    .toc { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 28px; margin-bottom: 40px; }
    .toc h2 { font-size: 13px; font-weight: 600; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; margin-bottom: 14px; }
    .toc ol { list-style: none; counter-reset: toc; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px 24px; }
    .toc li { counter-increment: toc; }
    .toc a { color: var(--text); text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 10px; padding: 4px 0; transition: color 0.15s; }
    .toc a::before { content: counter(toc, decimal-leading-zero); color: var(--primary); font-size: 12px; font-weight: 700; min-width: 22px; }
    .toc a:hover { color: var(--primary); }
    section { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 30px 32px; margin-bottom: 20px; }
    section h2 { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .section-num { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--primary-light); border-radius: 8px; color: var(--primary); font-size: 12px; font-weight: 700; flex-shrink: 0; }
    p { color: #c8cad4; font-size: 15px; margin-bottom: 12px; }
    p:last-child { margin-bottom: 0; }
    h3 { font-size: 14px; font-weight: 600; color: var(--text); margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .data-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    .data-table th { text-align: left; color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
    .data-table td { padding: 10px 12px; color: #c8cad4; border-bottom: 1px solid rgba(42,45,58,0.6); vertical-align: top; }
    .data-table tr:last-child td { border-bottom: none; }
    .pill { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .pill-green { background: rgba(39,174,96,0.15); color: #27ae60; border: 1px solid rgba(39,174,96,0.3); }
    .pill-yellow { background: rgba(243,156,18,0.15); color: #f39c12; border: 1px solid rgba(243,156,18,0.3); }
    .pill-blue { background: rgba(52,152,219,0.15); color: #3498db; border: 1px solid rgba(52,152,219,0.3); }
    ul { list-style: none; margin: 8px 0 12px; }
    ul li { color: #c8cad4; font-size: 15px; padding: 5px 0 5px 22px; position: relative; }
    ul li::before { content: '›'; position: absolute; left: 0; color: var(--primary); font-weight: 700; }
    .highlight-box { background: var(--primary-light); border: 1px solid rgba(224,90,58,0.2); border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
    .highlight-box p { color: #e8a090; font-size: 14px; margin: 0; }
    .contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
    .contact-card { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
    .contact-card .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-bottom: 6px; }
    .contact-card a { color: var(--primary); text-decoration: none; font-size: 14px; }
    .contact-card span { color: var(--text); font-size: 14px; }
    .rights-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 16px 0; }
    .right-item { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
    .right-item .right-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
    .right-item p { font-size: 13px; color: var(--muted); margin: 0; }
    footer { text-align: center; padding: 40px 0 20px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); margin-top: 40px; }
    footer strong { color: var(--text); }
    a { color: var(--primary); }
    @media (max-width: 600px) { section { padding: 22px 18px; } .toc ol { grid-template-columns: 1fr; } header { padding: 36px 0 28px; } }
  </style>
</head>
<body>
<div class="container">
  <header>
    <div class="logo-wrap">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 4C24 4 12 16 12 26C12 32.627 17.373 38 24 38C30.627 38 36 32.627 36 26C36 16 24 4 24 4Z" fill="#e05a3a"/>
        <path d="M24 16C24 16 18 22 18 27C18 30.314 20.686 33 24 33C27.314 33 30 30.314 30 27C30 22 24 16 24 16Z" fill="#f4845f"/>
        <circle cx="24" cy="27" r="4" fill="#ffcbb8"/>
      </svg>
    </div>
    <h1>Privacy Policy</h1>
    <p class="subtitle">${APP_NAME} · ${COMPANY}</p>
    <span class="badge">Aggiornata il ${LAST_UPDATED}</span>
  </header>

  <div class="toc">
    <h2>Indice</h2>
    <ol>
      <li><a href="#titolare">Titolare del trattamento</a></li>
      <li><a href="#dati">Dati raccolti</a></li>
      <li><a href="#finalita">Finalità del trattamento</a></li>
      <li><a href="#base-giuridica">Base giuridica</a></li>
      <li><a href="#conservazione">Conservazione</a></li>
      <li><a href="#condivisione">Condivisione dei dati</a></li>
      <li><a href="#trasferimento">Trasferimento internazionale</a></li>
      <li><a href="#diritti">Diritti dell'interessato</a></li>
      <li><a href="#minori">Minori</a></li>
      <li><a href="#sicurezza">Sicurezza</a></li>
      <li><a href="#modifiche">Modifiche alla policy</a></li>
      <li><a href="#contatti">Contatti</a></li>
    </ol>
  </div>

  <section id="titolare">
    <h2><span class="section-num">01</span> Titolare del trattamento</h2>
    <p>Il Titolare del trattamento dei dati personali raccolti tramite l'applicazione <strong>${APP_NAME}</strong> (Bundle ID: <code>${BUNDLE_ID}</code>) è <strong>${COMPANY}</strong>.</p>
    <div class="contact-grid">
      <div class="contact-card"><div class="label">Titolare</div><span>${COMPANY}</span></div>
      <div class="contact-card"><div class="label">E-mail privacy</div><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
    </div>
  </section>

  <section id="dati">
    <h2><span class="section-num">02</span> Dati raccolti</h2>
    <p>${APP_NAME} è progettata per funzionare in modo <strong>offline e locale</strong>, senza inviare dati a server esterni di terze parti. Di seguito il dettaglio dei dati trattati.</p>
    <h3>Dati memorizzati localmente sul dispositivo</h3>
    <table class="data-table">
      <thead><tr><th>Dato</th><th>Tipo</th><th>Dove viene salvato</th><th>Finalità</th></tr></thead>
      <tbody>
        <tr><td>Indirizzo IP e porta del server POS</td><td><span class="pill pill-blue">Configurazione</span></td><td>AsyncStorage (locale)</td><td>Connessione al server Rosso Fuoco Console</td></tr>
        <tr><td>Nome dell'amministratore</td><td><span class="pill pill-blue">Identità</span></td><td>AsyncStorage (locale)</td><td>Visualizzazione nell'interfaccia e firma autorizzazioni</td></tr>
        <tr><td>ID utente amministratore</td><td><span class="pill pill-blue">Identificativo</span></td><td>AsyncStorage (locale)</td><td>Sessione di accesso</td></tr>
        <tr><td>PIN amministratore (cifrato)</td><td><span class="pill pill-yellow">Credenziale</span></td><td>AsyncStorage (locale)</td><td>Accesso rapido senza reinserimento PIN</td></tr>
      </tbody>
    </table>
    <h3>Dati acquisiti temporaneamente durante l'uso</h3>
    <table class="data-table">
      <thead><tr><th>Dato</th><th>Tipo</th><th>Durata</th><th>Finalità</th></tr></thead>
      <tbody>
        <tr><td>Immagine del volto dalla fotocamera frontale</td><td><span class="pill pill-yellow">Biometrico</span></td><td>Solo in memoria durante il riconoscimento</td><td>Riconoscimento facciale per autenticazione admin</td></tr>
        <tr><td>Token di notifica push</td><td><span class="pill pill-blue">Tecnico</span></td><td>Sessione attiva</td><td>Ricezione notifiche richieste di autorizzazione</td></tr>
      </tbody>
    </table>
    <div class="highlight-box">
      <p>⚠️ <strong>Dati biometrici:</strong> le immagini del volto vengono elaborate esclusivamente in memoria locale per confrontarle con i profili registrati nel server POS aziendale. Nessuna immagine viene salvata sul dispositivo o trasmessa a server di terze parti.</p>
    </div>
    <h3>Dati NON raccolti</h3>
    <ul>
      <li>Dati di geolocalizzazione</li>
      <li>Dati di navigazione o analytics</li>
      <li>Contatti, foto o altri contenuti del dispositivo</li>
      <li>Identificatori pubblicitari (IDFA)</li>
      <li>Dati trasmessi a piattaforme di marketing o profilazione</li>
    </ul>
  </section>

  <section id="finalita">
    <h2><span class="section-num">03</span> Finalità del trattamento</h2>
    <p>I dati vengono trattati esclusivamente per le seguenti finalità:</p>
    <ul>
      <li><strong>Autenticazione amministratore</strong> — verifica dell'identità tramite PIN o riconoscimento facciale per accedere alle funzioni admin del POS.</li>
      <li><strong>Autorizzazione richieste POS</strong> — approvazione o rifiuto di richieste generate dagli operatori (annullamenti, sconti, rimborsi, ecc.).</li>
      <li><strong>Comunicazione con il server POS</strong> — invio e ricezione di dati verso Rosso Fuoco Console sulla rete locale aziendale.</li>
      <li><strong>Notifiche push</strong> — ricezione di avvisi in tempo reale per nuove richieste di autorizzazione.</li>
    </ul>
  </section>

  <section id="base-giuridica">
    <h2><span class="section-num">04</span> Base giuridica (GDPR)</h2>
    <p>Il trattamento dei dati si basa sulle seguenti basi giuridiche ai sensi del Regolamento (UE) 2016/679 (GDPR):</p>
    <table class="data-table">
      <thead><tr><th>Trattamento</th><th>Base giuridica</th><th>Articolo GDPR</th></tr></thead>
      <tbody>
        <tr><td>Autenticazione e accesso all'app</td><td>Esecuzione di un contratto / interesse legittimo</td><td>Art. 6(1)(b) e (f)</td></tr>
        <tr><td>Riconoscimento facciale (dato biometrico)</td><td>Consenso esplicito dell'interessato</td><td>Art. 6(1)(a) · Art. 9(2)(a)</td></tr>
        <tr><td>Notifiche push</td><td>Consenso esplicito (richiesta di sistema iOS)</td><td>Art. 6(1)(a)</td></tr>
        <tr><td>Gestione autorizzazioni POS</td><td>Esecuzione contratto di lavoro / interesse legittimo aziendale</td><td>Art. 6(1)(b) e (f)</td></tr>
      </tbody>
    </table>
  </section>

  <section id="conservazione">
    <h2><span class="section-num">05</span> Conservazione dei dati</h2>
    <table class="data-table">
      <thead><tr><th>Dato</th><th>Periodo di conservazione</th></tr></thead>
      <tbody>
        <tr><td>Configurazione server (IP, porta)</td><td>Fino alla modifica o disinstallazione dell'app</td></tr>
        <tr><td>Nome e ID amministratore, PIN</td><td>Fino alla disconnessione (logout) o disinstallazione</td></tr>
        <tr><td>Immagini del volto</td><td><span class="pill pill-green">Non conservate</span> — elaborate solo in memoria</td></tr>
        <tr><td>Token di notifica push</td><td>Fino alla revoca del permesso o disinstallazione</td></tr>
      </tbody>
    </table>
    <p>Tutti i dati locali vengono eliminati automaticamente alla disinstallazione dell'applicazione dal dispositivo iOS.</p>
  </section>

  <section id="condivisione">
    <h2><span class="section-num">06</span> Condivisione dei dati</h2>
    <p>${APP_NAME} <strong>non condivide alcun dato personale con terze parti</strong> a scopi commerciali, pubblicitari o di profilazione.</p>
    <p>I dati vengono trasmessi esclusivamente:</p>
    <ul>
      <li><strong>Al server POS aziendale</strong> (Rosso Fuoco Console) — tramite connessione HTTP sulla rete locale privata dell'azienda, configurata dall'utente.</li>
      <li><strong>Ad Apple (APNs)</strong> — token per la ricezione di notifiche push, gestito dalla piattaforma iOS secondo la <a href="https://www.apple.com/legal/privacy/it/" target="_blank">Privacy Policy di Apple</a>.</li>
    </ul>
    <p>Non vengono utilizzati SDK di analytics, advertising o tracking di alcun tipo.</p>
  </section>

  <section id="trasferimento">
    <h2><span class="section-num">07</span> Trasferimento internazionale dei dati</h2>
    <p>I dati operativi dell'app vengono trattati esclusivamente all'interno della rete locale aziendale e sul dispositivo dell'utente. Non avviene alcun trasferimento di dati personali verso paesi terzi al di fuori dello Spazio Economico Europeo (SEE).</p>
    <p>Il servizio notifiche push (Apple Push Notification Service) è soggetto ai termini di Apple Inc., che aderisce al Data Privacy Framework UE-USA.</p>
  </section>

  <section id="diritti">
    <h2><span class="section-num">08</span> Diritti dell'interessato</h2>
    <p>In qualità di interessato ai sensi del GDPR (artt. 15–22), hai il diritto di:</p>
    <div class="rights-grid">
      <div class="right-item"><div class="right-title">Accesso</div><p>Ottenere conferma del trattamento e copia dei dati (Art. 15)</p></div>
      <div class="right-item"><div class="right-title">Rettifica</div><p>Correggere dati inesatti o incompleti (Art. 16)</p></div>
      <div class="right-item"><div class="right-title">Cancellazione</div><p>Richiedere la cancellazione ("diritto all'oblio") (Art. 17)</p></div>
      <div class="right-item"><div class="right-title">Limitazione</div><p>Limitare il trattamento in determinate circostanze (Art. 18)</p></div>
      <div class="right-item"><div class="right-title">Portabilità</div><p>Ricevere i dati in formato strutturato e leggibile (Art. 20)</p></div>
      <div class="right-item"><div class="right-title">Opposizione</div><p>Opporsi al trattamento basato su interesse legittimo (Art. 21)</p></div>
      <div class="right-item"><div class="right-title">Revoca consenso</div><p>Revocare il consenso in qualsiasi momento (Art. 7)</p></div>
      <div class="right-item"><div class="right-title">Reclamo</div><p>Presentare reclamo al Garante Privacy italiano (Art. 77)</p></div>
    </div>
    <p style="margin-top:16px;">Per esercitare i tuoi diritti scrivi a: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Risponderemo entro 30 giorni.</p>
    <p>Puoi presentare reclamo all'autorità di controllo italiana: <a href="https://www.garanteprivacy.it" target="_blank">Garante per la Protezione dei Dati Personali</a>.</p>
  </section>

  <section id="minori">
    <h2><span class="section-num">09</span> Minori</h2>
    <p>${APP_NAME} è destinata esclusivamente a <strong>personale amministrativo adulto</strong> autorizzato dall'azienda. L'applicazione non è rivolta a minori di 18 anni e non raccoglie consapevolmente dati personali di minori. Se vieni a conoscenza che un minore ha utilizzato l'app senza autorizzazione, contattaci a <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  </section>

  <section id="sicurezza">
    <h2><span class="section-num">10</span> Sicurezza dei dati</h2>
    <p>Adottiamo le seguenti misure tecniche per proteggere i tuoi dati:</p>
    <ul>
      <li>I dati sono memorizzati nel <strong>Keychain/AsyncStorage</strong> protetto del dispositivo iOS.</li>
      <li>La comunicazione con il server POS avviene esclusivamente sulla <strong>rete locale privata</strong> dell'azienda, non attraverso Internet pubblico.</li>
      <li>Le immagini del volto non vengono mai scritte su disco — elaborate solo in memoria volatile e immediatamente scartate.</li>
      <li>L'accesso alle funzioni admin richiede autenticazione (PIN o riconoscimento volto) ad ogni sessione.</li>
      <li>L'app non trasmette dati verso server cloud esterni.</li>
    </ul>
    <p>In caso di violazione dei dati che possa comportare rischi per i diritti degli interessati, ne daremo comunicazione entro 72 ore all'autorità competente (Art. 33 GDPR).</p>
  </section>

  <section id="modifiche">
    <h2><span class="section-num">11</span> Modifiche alla presente policy</h2>
    <p>Ci riserviamo il diritto di aggiornare questa Privacy Policy in qualsiasi momento, ad esempio in seguito a modifiche legislative, aggiornamenti dell'applicazione o cambiamenti nelle modalità di trattamento dei dati.</p>
    <p>In caso di modifiche sostanziali, gli utenti saranno informati tramite notifica nell'applicazione o tramite aggiornamento visibile nella pagina di presentazione dell'app sull'App Store. La data di ultimo aggiornamento è sempre indicata in cima alla presente pagina.</p>
  </section>

  <section id="contatti">
    <h2><span class="section-num">12</span> Contatti</h2>
    <p>Per qualsiasi domanda relativa al trattamento dei tuoi dati personali o per esercitare i tuoi diritti:</p>
    <div class="contact-grid">
      <div class="contact-card"><div class="label">Titolare del trattamento</div><span>${COMPANY}</span></div>
      <div class="contact-card"><div class="label">E-mail privacy</div><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
      <div class="contact-card"><div class="label">App</div><span>${APP_NAME}</span></div>
      <div class="contact-card"><div class="label">Bundle Identifier</div><span style="font-size:13px;font-family:monospace;">${BUNDLE_ID}</span></div>
    </div>
  </section>

  <footer>
    <p><strong>${APP_NAME}</strong> · ${COMPANY}<br/>
    Informativa ai sensi del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003<br/>
    Ultimo aggiornamento: ${LAST_UPDATED}</p>
  </footer>
</div>
</body>
</html>`);
});

export default router;
