---
name: GitHub transport authorization
description: Distinzione tra autorizzazione API e trasporto Git/LFS nelle copie del progetto su GitHub.
---

Verificare separatamente l'autenticazione Git/LFS in scrittura prima di un trasferimento completo; non considerare sufficienti le API GitHub App o la lettura di un repository pubblico.

**Why:** Le API e la lettura pubblica possono funzionare mentre l'autenticazione in scrittura resta bloccata, anche con una connessione dichiarata attiva.

**How to apply:** Usare una verifica di push senza modifiche remote per distinguere accesso pubblico da autorizzazione in scrittura. Tenere credenziali e token fuori dalla chat.
