# Grupo Culata Jovái Arquitectos — Página web

Sitio estático (HTML + CSS + JS) publicado en Vercel, con un **panel de edición en `/admin`**
para cambiar textos e imágenes de cada página, en los 3 idiomas (es / en / de), sin tocar código.

- `index.html` — portada: carrusel de fotos, datos de contacto y redes.
- `sobre.html` — página "Sobre el estudio": foto y texto.
- `admin/` — panel de edición.
- `api/` — funciones de Vercel que guardan el contenido en una base de datos Postgres (Railway).
- `cms.js` — hace que las páginas muestren lo que se edita en el panel.
- `images/` — fotos originales del sitio.

---

## Panel de edición (`/admin`)

Entrá a `https://<tu-dominio>/admin`, ingresá con el usuario **`admin`** y la contraseña, y:

1. Elegí la **vista** arriba (Portada, Sobre el estudio, General).
2. Elegí el **idioma** (ES / EN / DE). Un número rojo en el idioma indica cuántos textos faltan traducir.
   Cuando editás en inglés o alemán, debajo de cada campo ves el texto en español como referencia.
3. Editá. A la derecha ves la **vista previa en vivo** (en compu o celular) antes de publicar.
4. Apretá **Publicar**. El sitio se actualiza en menos de un minuto.

- **Historial:** cada publicación queda guardada (las últimas 50). Desde *Historial* se puede volver a cualquier versión.
- **Descartar:** borra los cambios que todavía no publicaste.
- Si cerrás la pestaña sin publicar, los cambios quedan guardados en ese navegador y se ofrecen al volver.

### Imágenes
Al cambiar o agregar una imagen, el panel:
- muestra el **tamaño recomendado** para ese lugar y los pasos a seguir en el editor de fotos antes de subirla;
- **analiza el archivo** (resolución, proporción, peso, perfil de color, metadatos) y avisa si es chica, vertical o pesada;
- la **optimiza automáticamente** en el navegador: corrige la rotación, la achica al tamaño justo, elimina metadatos (GPS, cámara), la pasa a sRGB y la comprime en WebP;
- en el carrusel, cada foto tiene una **disposición**:
  - **Llenar**: ocupa todo el espacio y recorta lo que sobra.
  - **Completar**: se ve entera, con márgenes blancos.
  - **Completar vertical**: se ve todo el alto; los costados se recortan o quedan con margen.
  - **Completar horizontal**: se ve todo el ancho; arriba y abajo se recortan o quedan con margen.

  Al subir una foto vertical se elige "Completar" automáticamente; se puede cambiar en cualquier momento.
- con **Encuadre** se ve el **recuadro de encaje** sobre la foto: el negro es lo que se ve en la compu (pantalla 1440 × 900)
  y el rojo punteado lo que se ve en un iPhone 15. Se arrastra para mover el encuadre y desde la esquina para hacer zoom.
  Por defecto queda centrado y sin zoom (doble clic o "Restablecer encuadre" vuelve a eso).
- las vistas previas de Compu e iPhone se pueden **agrandar**, y la vista previa principal tiene el botón **Ampliar**.

| Lugar | Tamaño recomendado | Peso final |
|---|---|---|
| Carrusel (portada) | 2400 × 1600 px, horizontal 3:2 (mínimo 1920 px) | < 500 KB |
| Foto de "Sobre" | 2000 × 1333 px (mínimo 1600 px) | < 400 KB |
| Logo | ~950 × 180 px, PNG con fondo transparente | < 60 KB |

> Las fotos HEIC del iPhone no se pueden abrir en el navegador: exportalas como JPG antes.

---

## Configuración (una sola vez)

### 1. Base de datos en Railway
1. En [railway.app](https://railway.app) → **New Project** → **Database** → **PostgreSQL**.
2. Abrí la base → pestaña **Variables** (o **Connect**) → copiá **`DATABASE_PUBLIC_URL`**
   (la que tiene un dominio `*.proxy.rlwy.net`; la interna `postgres.railway.internal` no funciona desde Vercel).

Las tablas se crean solas la primera vez.

### 2. Variables en Vercel
En el proyecto de Vercel → **Settings → Environment Variables** (para *Production* y *Preview*):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la URL pública de Railway del paso anterior |
| `ADMIN_PASSWORD` | la contraseña del panel (larga, que no se use en otro lado) |
| `ADMIN_USER` | *(opcional)* otro nombre de usuario; si no se pone, el usuario es `admin` |
| `SESSION_SECRET` | *(opcional)* un texto largo al azar; si se cambia, se cierran todas las sesiones |

Después hacé un **Redeploy** para que las tome.

### Cómo funciona
- Mientras no se publique nada desde el panel, el sitio muestra el contenido escrito en los HTML.
- **Una vez que se publica desde el panel, el contenido sale de la base de datos**: editar los textos
  directamente en `index.html` / `sobre.html` ya no cambia lo que se ve. Usá el panel.
- Las imágenes subidas desde el panel se guardan en la base y se sirven desde `/api/img/...`
  con caché de un año en el CDN de Vercel (cada imagen nueva tiene un nombre nuevo).
- Si la base de datos no responde, el sitio sigue funcionando con el contenido de los HTML.

---

## Ver la página en la computadora (opcional, para quien programa)

Abrir `index.html` en el navegador muestra el sitio con el contenido de los HTML.
Para probar también el panel y la API: `npm install` y `npx vercel dev` (con las variables de entorno en un archivo `.env`).
