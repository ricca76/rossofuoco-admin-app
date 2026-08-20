---
name: Expo Go proxy startup
description: Compatibility constraints for serving an Expo Go manifest through the Replit Expo domain.
---

Quando Metro è raggiunto tramite il dominio Expo di Replit, il servizio pubblico deve diventare healthy subito e la richiesta iniziale deve ricevere un manifest con content type `application/expo+json`.

**Why:** alcune richieste iniziali di Expo Go non includono gli header che Metro usa per determinare piattaforma e formato di risposta. Senza una normalizzazione, Metro o il proxy possono produrre HTML generico/placeholder anziché il manifest, causando un errore 404 sul dispositivo.

**How to apply:** mantenere un piccolo proxy pubblico davanti a Metro: rispondere immediatamente a `/status`, aggiungere gli header Expo quando assenti e, per la root del manifest, richiedere esplicitamente il formato `application/expo+json`. Verificare dall'esterno sia la root sia il bundle restituito dal manifest.