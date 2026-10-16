# Grupo Culata Jovái Arquitectos — Página web

Sitio estático (HTML + CSS + JS, sin backend) publicado en Vercel.
Cada cambio que se guarda en GitHub se publica solo en la página en 1–2 minutos.

- `index.html` — portada: carrusel de fotos, datos de contacto y redes.
- `sobre.html` — página "Sobre el estudio": foto y texto.
- `images/carrusel/` — fotos del carrusel.
- `images/about-la-cuadrita.jpg` — foto de la página "Sobre".
- `images/logo.png` — logo.

---

## Cómo editar (sin instalar nada)

Todo se hace desde la web de GitHub, con tu usuario (tiene que tener acceso al repositorio).

**Editar un archivo de texto:** abrí el archivo en GitHub → ícono del lápiz ✏️ (arriba a la derecha) → hacé el cambio → botón verde **Commit changes** → otra vez **Commit changes**.

**Subir una foto:** entrá a la carpeta en GitHub (por ejemplo `images/carrusel`) → **Add file** → **Upload files** → arrastrá la foto → **Commit changes**.

Después de 1–2 minutos, abrí la página y apretá **Ctrl + F5** (en celular, abrila en una pestaña de incógnito) para ver la versión nueva.

> Si algo sale mal, no se pierde nada: en GitHub, en la pestaña **History** de cada archivo, se puede ver y recuperar cualquier versión anterior.

### Antes de subir una foto
- Formato **JPG**, de unos **2400 px de ancho** como máximo y **menos de 1,5 MB**. Las fotos de cámara (10–20 MB) hacen que la página cargue lenta: achicalas antes con https://squoosh.app (gratis, desde el navegador).
- Nombre del archivo **sin espacios, tildes, ñ ni símbolos** (por ejemplo `casa-ilona.jpg`, no `Casa Ilona © Federico.jpg`).

---

## Fotos del carrusel (portada)

### Reemplazar una foto (lo más fácil)
Subí la foto nueva a `images/carrusel/` con **exactamente el mismo nombre** que la que querés reemplazar (por ejemplo `06-casa-ilona.jpg`). GitHub reemplaza la anterior. No hay que tocar código.

### Agregar, quitar o cambiar el orden
1. Si es una foto nueva, subila primero a `images/carrusel/`.
2. Abrí `index.html` y editalo (lápiz ✏️). Buscá (Ctrl + F) `getCarouselImages`. Vas a ver una lista así:

   ```js
   return [
       { cover: 'images/carrusel/01-la-cuadrita-1.jpg', title: 'La Cuadrita' },
       { cover: 'images/carrusel/02-edificio-carpinelli.jpg', title: 'Edificio Carpinelli' },
       ...
       { cover: 'images/carrusel/19-obra-57a6456.jpg', title: 'Grupo Culata Jovái' }
   ];
   ```

   - **Cada línea es una foto**, en el orden en que aparecen.
   - `cover` = ubicación de la foto. `title` = nombre de la obra (no se ve, pero lo usan Google y los lectores de pantalla).
   - **Agregar:** copiá una línea, pegala donde quieras y cambiá el nombre del archivo y el título.
   - **Quitar:** borrá la línea entera.
   - **Reordenar:** mové las líneas.
   - Todas las líneas terminan en **coma**, **menos la última**.
3. Commit changes.

---

## Foto de la página "Sobre"

- **Reemplazarla:** subí la foto nueva a `images/` con el nombre `about-la-cuadrita.jpg`.
- **O con otro nombre:** subila a `images/`, abrí `sobre.html`, buscá `about-la-cuadrita.jpg` y cambiá ese nombre por el de la foto nueva. Ahí mismo, en `alt="..."`, podés poner una descripción de la foto.

---

## Textos de la página "Sobre"

⚠️ **Importante:** la página está en 3 idiomas (es / en / de). Los textos que se ven salen de la sección de **traducciones**, al final de `sobre.html`. Si solo cambiás el texto de arriba (el del HTML), **el cambio no se va a ver**.

1. Abrí `sobre.html` y editalo (lápiz ✏️).
2. Buscá (Ctrl + F) `const translations`. Vas a ver tres bloques: `es:` (español), `en:` (inglés) y `de:` (alemán). Cada párrafo tiene un nombre:

   ```js
   es: {
       'about-title': 'Sobre el estudio',
       'about-p1': 'Grupo Culata Jovái es un estudio de arquitectura...',
       'about-p2': 'Fundado en 2011 por ...',
       ...
   ```

   - `about-title` = título, `about-p1` = primer párrafo, `about-p2` = segundo, etc.
   - Cambiá solo el texto **entre las comillas simples** `'...'`. No borres las comillas ni la coma del final.
   - Si el texto lleva un apóstrofo, usá `’` (el tipográfico) en lugar de `'`, o escribilo como `\'`.
   - Hacé el mismo cambio en los tres idiomas (`es`, `en`, `de`).
3. (Recomendado) Cambiá también el mismo párrafo en el HTML de arriba (las líneas `<p data-i18n="about-p1">...</p>`), para que ambos coincidan.
4. Commit changes.

**Agregar un párrafo nuevo** (por ejemplo el 6):
- En el HTML, debajo del último párrafo, agregá: `<p data-i18n="about-p6">Texto del párrafo nuevo.</p>`
- En las traducciones, agregá `'about-p6': 'Texto...'` en `es`, `en` y `de` (acordate de la coma en la línea anterior).

---

## Textos de la portada (contacto y redes)

Abrí `index.html` y buscá (Ctrl + F):

| Qué cambiar | Qué buscar | Qué editar |
|---|---|---|
| Dirección | `Asunción, Paraguay` | el texto |
| Email | `contacto@` | aparece **dos veces** en la misma línea: en `mailto:...` (a dónde se envía) y el texto visible. Cambiá los dos. |
| Teléfono | `tel:` | también **dos veces**: en `tel:+595...` (sin espacios, para llamar desde el celular) y el texto visible. Cambiá los dos. |
| Instagram | `instagram.com` | la dirección entre comillas en `href="..."` |
| Facebook | `facebook.com` | la dirección entre comillas en `href="..."` |

Los títulos "Dirección", "Teléfono" y "Sobre" están traducidos: para cambiarlos, buscá `const translations` en `index.html` y editá el texto en `es`, `en` y `de`.

---

## Ver la página en la computadora (opcional, para quien programa)

Clonar el repositorio y abrir `index.html` en el navegador. No necesita instalar nada.
