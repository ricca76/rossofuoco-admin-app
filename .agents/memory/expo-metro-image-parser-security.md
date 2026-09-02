---
name: Expo Metro image parser security
description: Compatibilità tra Expo SDK 54, Metro e la sostituzione sicura di image-size.
---

Con Expo SDK 54 non forzare Metro 0.83.8 per rimuovere la dipendenza vulnerabile `image-size`: il file-map emette una forma evento incompatibile con Expo CLI 54 e il workflow termina durante il prewarm.

**Why:** Anche l'ultima patch di Expo CLI 54 continua ad aspettarsi la vecchia coda eventi. Il fork `image-size-next` 2.x cambia inoltre la forma dell'export e non è compatibile con la chiamata funzione predefinita usata da Metro.

**How to apply:** Mantieni la versione Metro supportata da Expo 54 e usa l'alias compatibile `image-size-next` della linea 1.x. Verifica sia `expo export` sia il prewarm iOS del workflow dopo ogni cambio.