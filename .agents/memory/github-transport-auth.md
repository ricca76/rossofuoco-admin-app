---
name: GitHub transport authorization
description: Distinzione tra autorizzazione API e trasporto Git/LFS nelle copie del progetto su GitHub.
---

Verificare separatamente l'autenticazione Git/LFS prima di creare una destinazione per un trasferimento completo; non considerare sufficiente il successo delle API GitHub App.

**Why:** In questo ambiente le chiamate API funzionavano mentre il trasporto Git rifiutava l'autenticazione, anche con una connessione dichiarata attiva.

**How to apply:** Per trasferimenti del progetto con file LFS, verificare il trasporto prima delle scritture sul repository remoto. Tenere credenziali e token fuori dalla chat.
