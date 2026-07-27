# Assets

- `icon.png` (1024x1024, morado de marca `#AB47BC` sólido) — **placeholder**, generado sin diseño real (encoder PNG a mano, ver historial). Es el único archivo que `app.json` referencia por ruta (`expo.icon`), así que es el único que bloquea `expo start`/EAS Build si falta. Reemplazar por el logo real antes de publicar en las tiendas.

## Por qué no hay splash.png ni adaptive-icon.png

`app.json` define `splash.backgroundColor` y `android.adaptiveIcon.backgroundColor` (ambos `#AB47BC`) **sin** una ruta de imagen (`splash.image` / `adaptiveIcon.foregroundImage`). Expo renderiza el color sólido nativamente en ese caso — no hace falta ningún archivo. Generar un `splash.png`/`adaptive-icon.png` sólido del mismo color no aportaría nada sobre lo que `backgroundColor` ya hace solo; agregarlos recién tiene sentido cuando haya un logo/wordmark real que mostrar, momento en el que también hay que agregar las claves `image`/`foregroundImage` correspondientes en `app.json`.
