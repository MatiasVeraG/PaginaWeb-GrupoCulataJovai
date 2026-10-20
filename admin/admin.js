/* Panel de edición — Grupo Culata Jovái
 * Edita textos (en es / en / de) e imágenes de cada vista, con vista previa en vivo.
 * Las imágenes se optimizan en el navegador antes de subirse.
 */
(function () {
    'use strict';

    const LANGS = ['es', 'en', 'de'];
    const LANG_NAMES = { es: 'Español', en: 'English', de: 'Deutsch' };
    const DRAFT_KEY = 'cj-admin-draft';

    const state = {
        published: null,   // contenido publicado
        version: 0,
        updatedAt: null,
        draft: null,       // contenido en edición
        view: 'home',
        lang: 'es',
        device: 'desktop'
    };

    // ------------------------------------------------------------------ utilidades
    const $ = sel => document.querySelector(sel);
    const clone = o => JSON.parse(JSON.stringify(o));

    function h(tag, attrs, ...children) {
        const el = document.createElement(tag);
        if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
                if (v === null || v === undefined || v === false) continue;
                if (k === 'class') el.className = v;
                else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
                else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
                else if (k in el && typeof v !== 'string') el[k] = v;
                else if (k === 'value') el.value = v;
                else el.setAttribute(k, v === true ? '' : v);
            }
        }
        for (const c of children.flat()) {
            if (c === null || c === undefined || c === false) continue;
            el.append(c.nodeType ? c : document.createTextNode(String(c)));
        }
        return el;
    }

    function getPath(obj, path) {
        return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    }
    function setPath(obj, path, value) {
        const keys = path.split('.');
        const last = keys.pop();
        const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
        target[last] = value;
    }

    function fmtBytes(n) {
        if (n == null) return '—';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
        return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
    }
    function fmtDate(d) {
        if (!d) return '';
        return new Date(d).toLocaleString('es-PY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function relTime(d) {
        if (!d) return '';
        const s = (Date.now() - new Date(d).getTime()) / 1000;
        if (s < 60) return 'hace instantes';
        if (s < 3600) return `hace ${Math.round(s / 60)} min`;
        if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
        return fmtDate(d);
    }
    function ratioLabel(w, hgt) {
        const r = w / hgt;
        const known = [[1, '1:1'], [4 / 3, '4:3'], [3 / 2, '3:2'], [16 / 10, '16:10'], [16 / 9, '16:9'], [3 / 4, '3:4'], [2 / 3, '2:3'], [9 / 16, '9:16']];
        const hit = known.find(([k]) => Math.abs(k - r) / k < 0.03);
        return hit ? hit[1] : r.toFixed(2).replace('.', ',') + ':1';
    }

    let toastTimer;
    function toast(msg, isError) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.toggle('error', !!isError);
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 6000 : 3500);
    }

    async function api(path, opts = {}) {
        const res = await fetch(path, {
            method: opts.method || 'GET',
            headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
            body: opts.body ? JSON.stringify(opts.body) : undefined,
            credentials: 'same-origin'
        });
        let data = null;
        try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
        if (res.status === 401 && path !== '/api/login') {
            showLogin('Tu sesión venció. Ingresá de nuevo: tus cambios sin publicar se conservan.');
        }
        if (!res.ok) {
            const err = new Error((data && data.error) || `Error ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    // ------------------------------------------------------------------ especificaciones de imágenes
    const SPECS = {
        carousel: {
            name: 'Foto del carrusel (portada)',
            recommended: '2400 × 1600 px',
            orientation: 'Horizontal, proporción 3:2',
            minimum: '1920 px de ancho',
            weight: 'menos de 500 KB',
            format: 'WebP (o JPG)',
            where: 'Ocupa toda la pantalla al lado del menú y se recorta para llenar el espacio: en compu se ve más ancha que alta y en celular casi vertical. Elegí el punto que nunca se debe cortar.',
            maxLong: 2400, minLong: 1920, idealRatio: 3 / 2, targetKB: 500,
            mime: 'image/webp', quality: 82, focal: true,
            crops: [{ label: 'Compu', ratio: 1.45 }, { label: 'Celular', ratio: 0.72 }],
            prep: [
                ['Elegí una toma horizontal', 'sin textos, firmas ni marcas de agua sobre la imagen.'],
                ['Corregí la perspectiva', 'que las líneas verticales del edificio queden rectas y el horizonte nivelado (Lightroom: Transformar → Auto/Vertical).'],
                ['Exportá en sRGB', 'los perfiles Adobe RGB o ProPhoto se ven lavados en la web.'],
                ['Exportá a 2400 px de ancho', 'en JPG calidad 85–90 %. Si subís el original de la cámara también funciona: el panel lo achica.'],
                ['Nombre y crédito', 'escribí el nombre de la obra; si la foto es de un fotógrafo, poné el crédito en el título.']
            ]
        },
        about: {
            name: 'Foto de “Sobre el estudio”',
            recommended: '2000 × 1333 px',
            orientation: 'Horizontal 3:2 (cualquier proporción funciona)',
            minimum: '1600 px de ancho',
            weight: 'menos de 400 KB',
            format: 'WebP (o JPG)',
            where: 'Se muestra completa, sin recortes, a unos 880 px de ancho (1760 px en pantallas retina).',
            maxLong: 2000, minLong: 1600, idealRatio: 3 / 2, targetKB: 400,
            mime: 'image/webp', quality: 82, focal: false,
            prep: [
                ['Recortá antes', 'la imagen se muestra entera: el encuadre que subas es el que se ve.'],
                ['Corregí la perspectiva', 'verticales rectas y horizonte nivelado.'],
                ['Exportá en sRGB', 'a 2000 px de ancho, JPG calidad 85–90 %.'],
                ['Describí la foto', 'el texto alternativo lo leen Google y los lectores de pantalla (en los 3 idiomas).']
            ]
        },
        logo: {
            name: 'Logo',
            recommended: '≈ 950 × 180 px',
            orientation: 'Horizontal, fondo transparente',
            minimum: '105 px de alto',
            weight: 'menos de 60 KB',
            format: 'PNG con transparencia',
            where: 'Se muestra a 35 px de alto en compu y 24–30 px en celular; 180 px de alto alcanza para pantallas retina.',
            maxHeight: 180, minHeight: 105, targetKB: 60,
            mime: 'image/png', quality: 90, focal: false, logo: true,
            prep: [
                ['Fondo transparente', 'exportá PNG con transparencia (no JPG, que agrega fondo blanco).'],
                ['Sin márgenes', 'recortá el espacio vacío alrededor del logo.'],
                ['Si tenés el logo en vector', '(AI/SVG), exportalo a 180 px de alto.']
            ]
        }
    };

    // ------------------------------------------------------------------ procesamiento de imágenes (en el navegador)
    async function decodeFile(file) {
        if ('createImageBitmap' in window) {
            try {
                const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
                return { source: bmp, width: bmp.width, height: bmp.height };
            } catch (e) { /* probar con <img> */ }
        }
        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise((ok, ko) => {
                const i = new Image();
                i.onload = () => ok(i);
                i.onerror = () => ko(new Error('decode'));
                i.src = url;
            });
            return { source: img, width: img.naturalWidth, height: img.naturalHeight };
        } finally {
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    // Redimensiona por pasos (mitades) para que no se vea serruchado.
    function resample(source, sw, sh, tw, th, background) {
        let cur = source, cw = sw, ch = sh;
        while (cw / 2 >= tw * 1.0001 && ch / 2 >= th * 1.0001) {
            const nw = Math.round(cw / 2), nh = Math.round(ch / 2);
            const c = document.createElement('canvas');
            c.width = nw; c.height = nh;
            const x = c.getContext('2d');
            x.imageSmoothingEnabled = true;
            x.imageSmoothingQuality = 'high';
            x.drawImage(cur, 0, 0, nw, nh);
            cur = c; cw = nw; ch = nh;
        }
        const out = document.createElement('canvas');
        out.width = tw; out.height = th;
        const ctx = out.getContext('2d');
        if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, tw, th); }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cur, 0, 0, tw, th);
        return out;
    }

    function encode(canvas, mime, quality) {
        return new Promise(ok => canvas.toBlob(b => ok(b), mime, quality));
    }

    function hasTransparency(source, w, hgt) {
        const sw = Math.min(200, w), sh = Math.max(1, Math.round(hgt * sw / w));
        const c = document.createElement('canvas');
        c.width = sw; c.height = sh;
        const x = c.getContext('2d');
        x.drawImage(source, 0, 0, sw, sh);
        const d = x.getImageData(0, 0, sw, sh).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
        return false;
    }

    // Lee los primeros KB del archivo para detectar perfil de color y metadatos.
    async function sniff(file) {
        const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
        let ascii = '';
        for (let i = 0; i < buf.length; i++) ascii += buf[i] > 31 && buf[i] < 127 ? String.fromCharCode(buf[i]) : ' ';
        return {
            adobeRgb: /Adobe RGB|AdobeRGB/.test(ascii),
            proPhoto: /ProPhoto/.test(ascii),
            displayP3: /Display P3/.test(ascii),
            exif: /Exif/.test(ascii),
            gps: /GPS/.test(ascii),
            camera: (ascii.match(/(Canon|NIKON|SONY|FUJIFILM|Apple|samsung|Panasonic|OLYMPUS|LEICA)[\w \-]{0,24}/) || [])[0]
        };
    }

    function targetSize(spec, w, hgt) {
        let scale = 1;
        if (spec.maxHeight) scale = Math.min(1, spec.maxHeight / hgt);
        else scale = Math.min(1, spec.maxLong / Math.max(w, hgt));
        return { tw: Math.max(1, Math.round(w * scale)), th: Math.max(1, Math.round(hgt * scale)) };
    }

    async function optimize(decoded, spec, opts) {
        const { source, width, height } = decoded;
        const { tw, th } = targetSize({ ...spec, maxLong: opts.maxLong || spec.maxLong }, width, height);
        const background = opts.mime === 'image/jpeg' ? '#ffffff' : null;
        const canvas = resample(source, width, height, tw, th, background);
        let quality = opts.quality / 100;
        let blob = await encode(canvas, opts.mime, quality);
        let mime = blob.type || opts.mime;
        let fellBack = false;
        if (opts.mime === 'image/webp' && mime !== 'image/webp') {
            // Safari antiguo no sabe generar WebP: usar JPG
            blob = await encode(canvas, 'image/jpeg', quality);
            mime = 'image/jpeg';
            fellBack = true;
        }
        let autoAdjusted = false;
        if (opts.auto && mime !== 'image/png') {
            while (blob.size > spec.targetKB * 1024 && quality > 0.76) {
                quality = Math.round((quality - 0.05) * 100) / 100;
                blob = await encode(canvas, mime, quality);
                autoAdjusted = true;
            }
        }
        return { blob, mime, width: tw, height: th, quality: Math.round(quality * 100), fellBack, autoAdjusted, canvas };
    }

    function blobToBase64(blob) {
        return new Promise((ok, ko) => {
            const r = new FileReader();
            r.onload = () => ok(String(r.result).split(',')[1]);
            r.onerror = ko;
            r.readAsDataURL(blob);
        });
    }

    // ------------------------------------------------------------------ modal de imagen
    /**
     * openImageModal({ specKey, current: {src, pos, title}, mode: 'new'|'replace'|'focus', titleField })
     * Resuelve con { src, pos, title } o null si se cancela.
     */
    function openImageModal(options) {
        const spec = SPECS[options.specKey];
        const dlg = $('#imageModal');
        const m = {
            file: null, decoded: null, info: null, result: null,
            pos: (options.current && options.current.pos) || '50% 50%',
            title: (options.current && options.current.title) || '',
            mime: spec.mime, quality: spec.quality, auto: true, maxLong: spec.maxLong,
            previewUrl: null, busy: false
        };

        return new Promise(resolve => {
            let finished = false;
            const finish = value => {
                if (finished) return;
                finished = true;
                if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
                if (m.decoded && m.decoded.source.close) m.decoded.source.close();
                dlg.close();
                resolve(value);
            };
            dlg.onclose = () => finish(null);
            dlg.oncancel = e => { if (m.busy) e.preventDefault(); };

            const headTitle = options.mode === 'focus' ? 'Encuadre de la foto'
                : options.mode === 'replace' ? `Reemplazar: ${spec.name}` : `Nueva imagen: ${spec.name}`;

            function render() {
                dlg.replaceChildren(h('div', { class: 'modal-inner' },
                    h('div', { class: 'modal-head' },
                        h('h2', null, headTitle),
                        h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Cerrar', onclick: () => !m.busy && finish(null) }, '✕')
                    ),
                    h('div', { class: 'modal-body' },
                        options.mode === 'focus' ? renderFocusStage(options.current.src) : (m.decoded ? renderStage() : renderDrop()),
                        h('div', { class: 'side' }, renderSide())
                    ),
                    renderFoot()
                ));
            }

            function renderRec() {
                return h('div', { class: 'rec' },
                    h('h4', null, 'Recomendado para este lugar'),
                    h('dl', { class: 'rec-grid' },
                        h('dt', null, 'Tamaño'), h('dd', null, spec.recommended),
                        h('dt', null, 'Forma'), h('dd', null, spec.orientation),
                        h('dt', null, 'Mínimo'), h('dd', null, spec.minimum),
                        h('dt', null, 'Peso final'), h('dd', null, spec.weight),
                        h('dt', null, 'Formato'), h('dd', null, spec.format)
                    ),
                    h('p', { class: 'rec-where' }, spec.where)
                );
            }

            function renderPrep() {
                return h('div', { class: 'block' },
                    h('h4', null, 'Antes de subir (en tu editor de fotos)'),
                    h('ol', { class: 'steps' }, spec.prep.map(([b, t]) => h('li', null, h('span', null, h('b', null, b + ': '), t))))
                );
            }

            function renderDrop() {
                const input = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: e => e.target.files[0] && loadFile(e.target.files[0]) });
                const drop = h('label', { class: 'drop' },
                    input,
                    h('div', null,
                        h('strong', null, m.busy ? 'Leyendo la imagen…' : 'Elegí o arrastrá una imagen'),
                        h('p', { class: 'muted' }, 'JPG, PNG, WebP o AVIF. Puede ser el archivo original de la cámara: el panel la optimiza.')
                    )
                );
                drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
                drop.addEventListener('dragleave', () => drop.classList.remove('over'));
                drop.addEventListener('drop', e => {
                    e.preventDefault();
                    drop.classList.remove('over');
                    const f = e.dataTransfer.files[0];
                    if (f) loadFile(f);
                });
                return h('div', { class: 'stage' }, drop, m.error ? h('p', { class: 'field-error' }, m.error) : null);
            }

            function focalBox(src, checker) {
                const [px, py] = m.pos.split(' ').map(parseFloat);
                const img = h('img', { src, alt: '' });
                const dot = spec.focal ? h('span', { class: 'dot', style: { left: px + '%', top: py + '%' } }) : null;
                const box = h('div', { class: 'focal' + (checker ? ' checker' : '') }, img, dot);
                if (spec.focal) {
                    const setFrom = e => {
                        const r = img.getBoundingClientRect();
                        const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
                        const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
                        m.pos = `${Math.round(x)}% ${Math.round(y)}%`;
                        dot.style.left = Math.round(x) + '%';
                        dot.style.top = Math.round(y) + '%';
                        box.parentNode.querySelectorAll('.crop img').forEach(ci => (ci.style.objectPosition = m.pos));
                    };
                    let dragging = false;
                    box.addEventListener('pointerdown', e => { dragging = true; box.setPointerCapture(e.pointerId); setFrom(e); });
                    box.addEventListener('pointermove', e => dragging && setFrom(e));
                    box.addEventListener('pointerup', () => (dragging = false));
                }
                return box;
            }

            function renderCrops(src) {
                if (!spec.crops) return null;
                return h('div', null,
                    h('p', { class: 'field-hint', style: { marginBottom: '6px' } }, 'Tocá o arrastrá sobre la foto para marcar lo más importante. Así se va a recortar:'),
                    h('div', { class: 'crops' }, spec.crops.map(c => h('div', { class: 'crop' },
                        h('div', { style: { width: Math.round(96 * c.ratio) + 'px' } }, h('img', { src, alt: '', style: { objectPosition: m.pos } })),
                        h('span', null, c.label)
                    )))
                );
            }

            function renderFocusStage(src) {
                return h('div', { class: 'stage' }, focalBox(src), renderCrops(src));
            }

            function renderStage() {
                const src = m.previewUrl;
                return h('div', { class: 'stage' },
                    focalBox(src, spec.logo),
                    renderCrops(src),
                    m.result ? h('div', { class: 'compare muted' },
                        h('span', null, `Original: ${m.decoded.width} × ${m.decoded.height} px · ${fmtBytes(m.file.size)}`),
                        h('span', null, '→'),
                        h('span', null, `Optimizada: ${m.result.width} × ${m.result.height} px · ${fmtBytes(m.result.blob.size)}`)
                    ) : null,
                    h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { resetFile(); render(); } }, 'Elegir otra imagen')
                );
            }

            function renderAnalysis() {
                const { width: w, height: hh } = m.decoded;
                const info = m.info;
                const items = [];
                const add = (level, html) => items.push(h('li', { class: level }, h('span', { class: 'ic' }, { ok: '✓', warn: '!', bad: '✕', info: 'i' }[level]), h('span', null, ...html)));

                add('info', [h('b', null, m.file.name), ` · ${(m.file.type || '').replace('image/', '').toUpperCase() || 'imagen'} · ${w} × ${hh} px · ${fmtBytes(m.file.size)} · ${ratioLabel(w, hh)}`]);

                if (spec.logo) {
                    if (hh < spec.minHeight) add('warn', [h('b', null, 'Muy chico: '), `tiene ${hh} px de alto; con menos de ${spec.minHeight} px se ve borroso en pantallas retina.`]);
                    else add('ok', [h('b', null, 'Resolución suficiente '), `(${hh} px de alto).`]);
                    if (info.transparent) add('ok', [h('b', null, 'Fondo transparente '), 'detectado.']);
                    else add('warn', [h('b', null, 'Sin transparencia: '), 'el logo va a tener fondo de color. Si el sitio cambia de fondo, se va a notar el recuadro.']);
                } else {
                    const long = Math.max(w, hh);
                    if (long < spec.minLong * 0.7) add('bad', [h('b', null, 'Resolución baja: '), `${long} px del lado largo. Se va a ver borrosa en pantallas grandes; conseguí una versión de al menos ${spec.minLong} px.`]);
                    else if (long < spec.minLong) add('warn', [h('b', null, 'Un poco chica: '), `${long} px del lado largo (ideal ${spec.maxLong}). Puede verse algo blanda en monitores grandes.`]);
                    else add('ok', [h('b', null, 'Resolución suficiente '), `(${long} px del lado largo).`]);

                    const r = w / hh;
                    if (options.specKey === 'carousel') {
                        if (r < 1) add('warn', [h('b', null, 'Foto vertical: '), 'en la compu se va a recortar mucho arriba y abajo. Preferí una toma horizontal o marcá bien el punto de enfoque.']);
                        else if (Math.abs(r - spec.idealRatio) / spec.idealRatio > 0.12) add('info', [h('b', null, `Proporción ${ratioLabel(w, hh)}: `), 'funciona, pero se recorta distinto que el resto. Revisá los recortes de la izquierda.']);
                        else add('ok', [h('b', null, 'Proporción adecuada '), `(${ratioLabel(w, hh)}).`]);
                    } else if (r < 1) {
                        add('info', [h('b', null, 'Foto vertical: '), 'se va a mostrar entera y ocupa mucho alto en la página. Funciona, pero horizontal 3:2 queda mejor.']);
                    }
                }

                if (m.file.size > 1.5 * 1024 * 1024) add('warn', [h('b', null, 'Archivo pesado: '), `${fmtBytes(m.file.size)}. Sin optimizar haría que la página cargue lento, sobre todo en celular. Se optimiza abajo.`]);
                if (info.adobeRgb || info.proPhoto) add('warn', [h('b', null, `Perfil de color ${info.adobeRgb ? 'Adobe RGB' : 'ProPhoto'}: `), 'el navegador lo convierte a sRGB al optimizar, pero para colores exactos exportala en sRGB desde tu editor.']);
                if (info.gps) add('info', [h('b', null, 'Tiene ubicación GPS '), 'en los metadatos: se elimina al optimizar.']);
                else if (info.exif) add('info', [h('b', null, 'Tiene metadatos EXIF '), info.camera ? `(${info.camera.trim()})` : '', ': se eliminan al optimizar.']);

                return h('div', { class: 'block' }, h('h4', null, 'Análisis de tu archivo'), h('ul', { class: 'checks' }, items));
            }

            function renderOptimize() {
                const r = m.result;
                const formatOptions = spec.logo
                    ? [['image/png', 'PNG (recomendado)'], ['image/webp', 'WebP']]
                    : [['image/webp', 'WebP (recomendado)'], ['image/jpeg', 'JPG']];
                const sizeOptions = spec.logo ? null : [
                    [spec.maxLong, `${spec.maxLong} px (recomendado)`],
                    [Math.round(spec.maxLong * 0.8), `${Math.round(spec.maxLong * 0.8)} px (más liviano)`],
                    [Math.round(spec.maxLong * 1.25), `${Math.round(spec.maxLong * 1.25)} px (más detalle)`]
                ];

                const qualityOut = h('output', null, String(m.quality));
                const controls = h('div', { class: 'opt-controls' },
                    h('label', { class: 'field', title: spec.logo ? 'PNG conserva la transparencia sin pérdida' : 'WebP pesa ~30 % menos que JPG con la misma calidad y lo leen todos los navegadores actuales' }, h('span', { class: 'field-label' }, 'Formato'),
                        h('select', { onchange: e => { m.mime = e.target.value; reprocess(); } },
                            formatOptions.map(([v, l]) => h('option', { value: v, selected: v === m.mime }, l)))),
                    sizeOptions ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Lado largo máximo'),
                        h('select', { onchange: e => { m.maxLong = Number(e.target.value); reprocess(); } },
                            sizeOptions.map(([v, l]) => h('option', { value: v, selected: v === m.maxLong }, l)))) : h('span'),
                    m.mime !== 'image/png' ? h('label', { class: 'field full' },
                        h('span', { class: 'field-label' }, 'Calidad', h('span', { class: 'muted small' }, '75–85 es invisible al ojo y pesa mucho menos')),
                        h('div', { class: 'range-row' },
                            h('input', {
                                type: 'range', min: 60, max: 95, step: 1, value: String(m.quality),
                                oninput: e => { qualityOut.textContent = e.target.value; },
                                onchange: e => { m.quality = Number(e.target.value); m.auto = false; reprocess(); }
                            }),
                            qualityOut)) : null
                );

                const steps = [];
                if (r) {
                    const add = (level, ...html) => steps.push(h('li', { class: level }, h('span', { class: 'ic' }, level === 'ok' ? '✓' : '!'), h('span', null, ...html)));
                    add('ok', h('b', null, 'Rotación corregida '), 'según la orientación de la cámara.');
                    if (r.width !== m.decoded.width) add('ok', h('b', null, 'Redimensionada: '), `${m.decoded.width} × ${m.decoded.height} → ${r.width} × ${r.height} px.`);
                    else add('ok', h('b', null, 'Tamaño conservado '), '(no se agranda: agrandar no agrega detalle).');
                    add('ok', h('b', null, 'Metadatos eliminados '), '(ubicación, cámara, miniaturas).');
                    add('ok', h('b', null, 'Colores en sRGB '), 'para que se vean igual en todos los navegadores.');
                    add(r.fellBack ? 'warn' : 'ok', h('b', null, `Comprimida en ${r.mime.replace('image/', '').toUpperCase()}`),
                        r.mime === 'image/png' ? ' (sin pérdida).' : ` calidad ${r.quality}${r.autoAdjusted ? ' (ajustada automáticamente para llegar al peso ideal)' : ''}.`,
                        r.fellBack ? ' Este navegador no genera WebP; se usó JPG.' : '');
                }

                const saved = r ? Math.max(0, Math.round((1 - r.blob.size / m.file.size) * 100)) : 0;
                const over = r && r.blob.size > spec.targetKB * 1024;
                return h('div', { class: 'block' },
                    h('h4', null, 'Optimización automática'),
                    controls,
                    m.processing ? h('p', { class: 'working' }, 'Optimizando…') : h('ul', { class: 'checks' }, steps),
                    r && !m.processing ? h('div', { class: 'result' + (over ? ' warn' : '') },
                        h('span', { class: 'big' }, fmtBytes(r.blob.size)),
                        h('span', null, saved > 0 ? `${saved} % menos que el original. ` : '',
                            over
                                ? `Un poco más que el ideal (${spec.weight}). Es normal en fotos con mucho detalle (follaje, texturas); para aligerarla elegí un lado largo menor.`
                                : 'Dentro del peso ideal ✓')
                    ) : null
                );
            }

            function renderMeta() {
                if (!options.titleField) return null;
                return h('div', { class: 'block' },
                    h('label', { class: 'field' },
                        h('span', { class: 'field-label' }, options.titleField.label),
                        h('input', { type: 'text', value: m.title, maxlength: 200, oninput: e => (m.title = e.target.value) }),
                        h('span', { class: 'field-hint' }, options.titleField.hint)
                    ));
            }

            function renderSide() {
                if (options.mode === 'focus') return [renderMeta(), renderRec()];
                if (!m.decoded) return [renderRec(), renderPrep()];
                return [renderAnalysis(), renderOptimize(), renderMeta()];
            }

            function renderFoot() {
                const canUse = options.mode === 'focus' || (m.result && !m.processing);
                return h('div', { class: 'modal-foot' },
                    h('span', { class: 'muted' }, m.busy ? 'Subiendo imagen…' : (options.mode === 'focus' ? '' : 'La imagen se publica recién cuando apretás “Publicar”.')),
                    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                        m.busy ? h('div', { class: 'progress' }, h('span', { style: { width: '70%' } })) : null,
                        h('button', { class: 'btn', type: 'button', disabled: m.busy, onclick: () => finish(null) }, 'Cancelar'),
                        h('button', { class: 'btn btn-primary', type: 'button', disabled: !canUse || m.busy, onclick: accept },
                            options.mode === 'focus' ? 'Guardar' : 'Usar esta imagen')
                    ));
            }

            function resetFile() {
                if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
                if (m.decoded && m.decoded.source.close) m.decoded.source.close();
                Object.assign(m, { file: null, decoded: null, info: null, result: null, previewUrl: null, error: null });
            }

            async function loadFile(file) {
                resetFile();
                m.busy = true;
                render();
                try {
                    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
                        throw new Error('heic');
                    }
                    m.decoded = await decodeFile(file);
                    m.file = file;
                    m.info = await sniff(file);
                    if (spec.logo) {
                        m.info.transparent = hasTransparency(m.decoded.source, m.decoded.width, m.decoded.height);
                        m.mime = m.info.transparent ? 'image/png' : 'image/webp';
                    }
                    m.previewUrl = URL.createObjectURL(file);
                    if (!m.title && options.titleField) {
                        m.title = file.name.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim();
                        m.title = m.title.charAt(0).toUpperCase() + m.title.slice(1);
                    }
                    m.busy = false;
                    await reprocess();
                } catch (e) {
                    m.busy = false;
                    resetFile();
                    m.error = e.message === 'heic'
                        ? 'Las fotos HEIC del iPhone no se pueden abrir en el navegador. Exportala como JPG (en el iPhone: Ajustes → Cámara → Formatos → “Más compatible”, o compartila por mail/WhatsApp) y probá de nuevo.'
                        : 'No se pudo abrir el archivo. Asegurate de que sea una imagen JPG, PNG o WebP.';
                    render();
                }
            }

            async function reprocess() {
                m.processing = true;
                render();
                await new Promise(r => setTimeout(r, 30));
                try {
                    m.result = await optimize(m.decoded, spec, { mime: m.mime, quality: m.quality, auto: m.auto, maxLong: m.maxLong });
                    if (m.result.autoAdjusted) m.quality = m.result.quality;
                    if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
                    m.previewUrl = URL.createObjectURL(m.result.blob);
                } catch (e) {
                    m.error = 'No se pudo optimizar la imagen.';
                }
                m.processing = false;
                render();
            }

            async function accept() {
                if (options.mode === 'focus') {
                    return finish({ src: options.current.src, pos: m.pos, title: m.title });
                }
                if (m.result.blob.size > 3 * 1024 * 1024) {
                    toast('La imagen todavía pesa más de 3 MB. Bajá la calidad o el tamaño.', true);
                    return;
                }
                m.busy = true;
                render();
                try {
                    const data = await blobToBase64(m.result.blob);
                    const res = await api('/api/upload', {
                        method: 'POST',
                        body: { data, mime: m.result.mime, width: m.result.width, height: m.result.height, name: m.file.name }
                    });
                    m.busy = false;
                    finish({ src: res.src, pos: m.pos, title: m.title, width: res.width, height: res.height, bytes: res.bytes });
                } catch (e) {
                    m.busy = false;
                    render();
                    toast('No se pudo subir: ' + e.message, true);
                }
            }

            render();
            dlg.showModal();
        });
    }

    // ------------------------------------------------------------------ campos del editor
    function draftChanged() {
        updateStatus();
        updateLangBadges();
        schedulePreview();
        saveLocalDraft();
    }

    function trField({ path, label, multiline, rows, hint, maxlength }) {
        const value = getPath(state.draft, path) || {};
        const lang = state.lang;
        const wrap = h('label', { class: 'field' });
        const update = () => wrap.classList.toggle('missing', lang !== 'es' && !!(value.es || '').trim() && !(value[lang] || '').trim());
        const input = h(multiline ? 'textarea' : 'input', {
            type: multiline ? null : 'text',
            rows: multiline ? (rows || 4) : null,
            maxlength: maxlength || null,
            value: value[lang] || '',
            placeholder: lang !== 'es' && value.es ? 'Falta la traducción' : '',
            oninput: e => {
                const v = clone(getPath(state.draft, path) || {});
                v[lang] = e.target.value;
                setPath(state.draft, path, v);
                Object.assign(value, v);
                update();
                draftChanged();
            }
        });
        wrap.append(...[
            h('span', { class: 'field-label' }, label, h('span', { class: 'lang-chip' }, lang)),
            input,
            lang !== 'es' && value.es ? h('span', { class: 'field-ref' }, h('b', null, 'ES: '), value.es) : null,
            hint ? h('span', { class: 'field-hint' }, hint) : null
        ].filter(Boolean));
        update();
        return wrap;
    }

    function plainField({ path, label, type, hint, placeholder, validate }) {
        const err = h('span', { class: 'field-error' });
        const check = v => { err.textContent = validate ? (validate(v) || '') : ''; };
        const input = h('input', {
            type: type || 'text', value: getPath(state.draft, path) || '', placeholder: placeholder || '',
            oninput: e => { setPath(state.draft, path, e.target.value); check(e.target.value); draftChanged(); }
        });
        const wrap = h('label', { class: 'field' },
            h('span', { class: 'field-label' }, label, h('span', { class: 'lang-chip', title: 'Igual en todos los idiomas' }, 'todos')),
            input, err, hint ? h('span', { class: 'field-hint' }, hint) : null);
        check(input.value);
        return wrap;
    }

    const isUrl = v => !v || /^https?:\/\/\S+$/i.test(v) ? '' : 'Tiene que empezar con https://';
    const isEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Revisá el email';

    function card(title, subtitle, ...children) {
        return h('section', { class: 'card' },
            h('div', { class: 'card-head' }, h('h3', null, title), subtitle ? h('span', { class: 'muted' }, subtitle) : null),
            ...children);
    }

    // Revisa el tamaño real de las imágenes ya publicadas para avisar si alguna es chica.
    function auditImage(img, flagEl, spec) {
        const check = () => {
            const long = Math.max(img.naturalWidth, img.naturalHeight);
            if (spec.minLong && long && long < spec.minLong) {
                flagEl.textContent = `${long} px`;
                flagEl.title = `Más chica que lo recomendado (${spec.minLong} px). Puede verse borrosa en pantallas grandes.`;
                flagEl.hidden = false;
            }
        };
        if (img.complete) check(); else img.addEventListener('load', check, { once: true });
    }

    function imageField({ path, specKey, label, altMode }) {
        const spec = SPECS[specKey];
        const value = getPath(state.draft, path);
        const img = h('img', { src: '/' + value.src.replace(/^\//, ''), alt: '' });
        const sizeInfo = h('span', null, 'Cargando…');
        img.addEventListener('load', () => {
            const long = Math.max(img.naturalWidth, img.naturalHeight);
            const small = spec.minLong ? long < spec.minLong : img.naturalHeight < spec.minHeight;
            sizeInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight} px` + (small ? ' · ⚠ más chica que lo recomendado' : '');
        });
        const altFields = altMode === 'tr'
            ? trField({ path: path + '.alt', label: 'Descripción de la imagen', hint: 'La leen Google y los lectores de pantalla. Incluí el crédito de la foto.' })
            : altMode === 'plain'
                ? plainField({ path: path + '.alt', label: 'Texto alternativo' })
                : null;
        return card(label, `Recomendado: ${spec.recommended}`,
            h('div', { class: 'image-field' },
                h('div', { class: 'thumb' + (spec.logo ? ' checker' : '') }, img),
                h('div', { class: 'info' },
                    sizeInfo,
                    h('div', null,
                        h('button', {
                            class: 'btn btn-sm', type: 'button',
                            onclick: async () => {
                                const r = await openImageModal({ specKey, mode: 'replace', current: value });
                                if (!r) return;
                                setPath(state.draft, path + '.src', r.src);
                                draftChanged();
                                renderEditor();
                                toast('Imagen lista. Revisá la vista previa y apretá “Publicar”.');
                            }
                        }, 'Cambiar imagen…'))
                )),
            altFields ? h('div', { style: { marginTop: '14px' } }, altFields) : null
        );
    }

    function carouselEditor() {
        const list = h('div', { class: 'list' });
        const items = state.draft.home.carousel;
        let dragFrom = null;

        const move = (from, to) => {
            if (to < 0 || to >= items.length || from === to) return;
            const [it] = items.splice(from, 1);
            items.splice(to, 0, it);
            draftChanged();
            renderEditor();
        };

        items.forEach((item, i) => {
            const flag = h('span', { class: 'flag', hidden: true });
            const img = h('img', { src: '/' + item.src.replace(/^\//, ''), alt: '', loading: 'lazy', style: { objectPosition: item.pos || '50% 50%' } });
            auditImage(img, flag, SPECS.carousel);
            const el = h('div', { class: 'list-item slide-item', draggable: true },
                h('div', { class: 'slide-thumb', title: 'Arrastrá para reordenar' }, img, flag),
                h('div', { class: 'slide-body' },
                    h('div', { class: 'list-item-head' },
                        h('span', { class: 'num' }, `FOTO ${i + 1} DE ${items.length}`),
                        h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
                        h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: 'Bajar', 'aria-label': 'Bajar', disabled: i === items.length - 1, onclick: () => move(i, i + 1) }, '↓')
                    ),
                    h('input', {
                        type: 'text', value: item.title, placeholder: 'Nombre de la obra', 'aria-label': 'Nombre de la obra',
                        class: 'slide-title', style: { width: '100%', border: '1px solid var(--line-strong)', borderRadius: '6px', padding: '6px 9px' },
                        oninput: e => { item.title = e.target.value; draftChanged(); }
                    }),
                    h('div', { class: 'slide-actions' },
                        h('button', {
                            class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
                                const r = await openImageModal({ specKey: 'carousel', mode: 'focus', current: { ...item, src: '/' + item.src.replace(/^\//, '') }, titleField: TITLE_FIELD });
                                if (!r) return;
                                item.pos = r.pos; item.title = r.title;
                                draftChanged(); renderEditor();
                            }
                        }, 'Encuadre'),
                        h('button', {
                            class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
                                const r = await openImageModal({ specKey: 'carousel', mode: 'replace', current: item, titleField: TITLE_FIELD });
                                if (!r) return;
                                Object.assign(item, { src: r.src, pos: r.pos, title: r.title });
                                draftChanged(); renderEditor();
                                toast('Foto reemplazada. Apretá “Publicar” para que se vea en el sitio.');
                            }
                        }, 'Reemplazar'),
                        h('button', {
                            class: 'btn btn-ghost btn-sm btn-danger', type: 'button', disabled: items.length <= 1, onclick: () => {
                                if (!window.confirm(`¿Quitar “${item.title || 'esta foto'}” del carrusel?`)) return;
                                items.splice(i, 1);
                                draftChanged(); renderEditor();
                            }
                        }, 'Quitar')
                    ),
                    h('span', { class: 'meta', title: item.src }, item.src.split('/').pop())
                )
            );
            el.addEventListener('dragstart', e => { dragFrom = i; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
            el.addEventListener('dragend', () => { el.classList.remove('dragging'); list.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target')); });
            el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
            el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
            el.addEventListener('drop', e => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); dragFrom = null; });
            list.append(el);
        });

        return card('Carrusel de fotos', `${items.length} fotos · recomendado 2400 × 1600 px`,
            h('p', { class: 'field-hint', style: { marginBottom: '12px' } }, 'Arrastrá las miniaturas para cambiar el orden. El nombre de la obra no se ve en la foto, pero lo usan Google y los lectores de pantalla (es igual en todos los idiomas).'),
            list,
            h('button', {
                class: 'btn add-btn', type: 'button', onclick: async () => {
                    const r = await openImageModal({ specKey: 'carousel', mode: 'new', titleField: TITLE_FIELD });
                    if (!r) return;
                    items.push({ src: r.src, title: r.title, pos: r.pos });
                    draftChanged(); renderEditor();
                    toast('Foto agregada al final del carrusel.');
                }
            }, '+ Agregar foto')
        );
    }
    const TITLE_FIELD = { label: 'Nombre de la obra', hint: 'Ej.: “Casa Ilona”. No se ve sobre la foto; lo usan Google y los lectores de pantalla.' };

    function paragraphsEditor() {
        const items = state.draft.sobre.paragraphs;
        const list = h('div', { class: 'list' });
        items.forEach((p, i) => {
            list.append(h('div', { class: 'list-item' },
                h('div', { class: 'list-item-head' },
                    h('span', { class: 'num' }, `PÁRRAFO ${i + 1}`),
                    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: 'Subir', disabled: i === 0, onclick: () => { items.splice(i - 1, 0, items.splice(i, 1)[0]); draftChanged(); renderEditor(); } }, '↑'),
                    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: 'Bajar', disabled: i === items.length - 1, onclick: () => { items.splice(i + 1, 0, items.splice(i, 1)[0]); draftChanged(); renderEditor(); } }, '↓'),
                    h('button', {
                        class: 'btn btn-ghost btn-sm btn-danger', type: 'button', onclick: () => {
                            if (!window.confirm('¿Borrar este párrafo en los 3 idiomas?')) return;
                            items.splice(i, 1); draftChanged(); renderEditor();
                        }
                    }, 'Borrar')
                ),
                trField({ path: `sobre.paragraphs.${i}`, label: 'Texto', multiline: true, rows: 5 })
            ));
        });
        return card('Texto', `${items.length} párrafos`,
            list,
            h('button', {
                class: 'btn add-btn', type: 'button', onclick: () => {
                    items.push({ es: '', en: '', de: '' });
                    draftChanged(); renderEditor();
                    const areas = document.querySelectorAll('#editor textarea');
                    areas[areas.length - 1].focus();
                }
            }, '+ Agregar párrafo'));
    }

    // ------------------------------------------------------------------ vistas
    const VIEWS = {
        home: {
            name: 'Portada',
            page: '/index.html',
            intro: 'Datos de contacto, redes y fotos del carrusel.',
            render: () => [
                card('Contacto', null,
                    trField({ path: 'home.address', label: 'Dirección' }),
                    plainField({ path: 'home.email', label: 'Email', type: 'email', validate: isEmail, hint: 'Si lo dejás vacío, no se muestra.' }),
                    plainField({ path: 'home.phone', label: 'Teléfono', placeholder: '+595 981 000 000', hint: 'Con código de país. El link para llamar desde el celular se arma solo.' })
                ),
                card('Títulos del menú', null,
                    trField({ path: 'home.labels.address', label: 'Título “Dirección”' }),
                    trField({ path: 'home.labels.phone', label: 'Título “Teléfono”' }),
                    trField({ path: 'home.labels.about', label: 'Link a “Sobre”' })
                ),
                card('Redes sociales', null,
                    plainField({ path: 'home.instagram', label: 'Instagram', type: 'url', validate: isUrl, hint: 'Si lo dejás vacío, el link no se muestra.' }),
                    plainField({ path: 'home.facebook', label: 'Facebook', type: 'url', validate: isUrl })
                ),
                carouselEditor()
            ]
        },
        sobre: {
            name: 'Sobre el estudio',
            page: '/sobre.html',
            intro: 'Título, foto y texto de la página “Sobre”.',
            render: () => [
                card('Encabezado', null,
                    trField({ path: 'sobre.title', label: 'Título' }),
                    trField({ path: 'sobre.description', label: 'Descripción para Google', multiline: true, rows: 3, maxlength: 400, hint: 'No se ve en la página: es el texto que muestra Google debajo del título. Ideal: 140–160 caracteres.' })
                ),
                imageField({ path: 'sobre.image', specKey: 'about', label: 'Foto', altMode: 'tr' }),
                paragraphsEditor()
            ]
        },
        global: {
            name: 'General',
            page: '/index.html',
            intro: 'Elementos que se repiten en todas las páginas.',
            render: () => [
                imageField({ path: 'global.logo', specKey: 'logo', label: 'Logo', altMode: 'plain' })
            ]
        }
    };

    function renderTabs() {
        $('#viewTabs').replaceChildren(...Object.entries(VIEWS).map(([id, v]) =>
            h('button', { type: 'button', class: id === state.view ? 'active' : '', onclick: () => setView(id) }, v.name)));
        updateLangBadges();
    }

    function updateLangBadges() {
        const missing = countMissing();
        $('#langTabs').replaceChildren(...LANGS.map(l =>
            h('button', {
                type: 'button', role: 'tab', class: l === state.lang ? 'active' : '', 'aria-selected': String(l === state.lang),
                title: missing[l] ? `${missing[l]} textos sin traducir` : LANG_NAMES[l],
                onclick: () => setLang(l)
            }, l, missing[l] ? h('span', { class: 'badge' }, missing[l]) : null)));
    }

    function translatableValues(c) {
        const out = [c.home.address, c.home.labels.address, c.home.labels.phone, c.home.labels.about,
            c.sobre.title, c.sobre.description, c.sobre.image.alt, ...c.sobre.paragraphs];
        return out.filter(Boolean);
    }

    function countMissing() {
        const res = { es: 0, en: 0, de: 0 };
        if (!state.draft) return res;
        for (const v of translatableValues(state.draft)) {
            if (!(v.es || '').trim()) continue;
            for (const l of ['en', 'de']) if (!(v[l] || '').trim()) res[l]++;
        }
        return res;
    }

    function renderEditor() {
        const view = VIEWS[state.view];
        const scroll = $('#editor').scrollTop;
        $('#editor').replaceChildren(
            h('div', { class: 'view-intro' },
                h('h2', null, view.name),
                h('p', null, view.intro),
                h('div', { class: 'lang-note' },
                    h('span', null, 'Editando en ', h('strong', null, LANG_NAMES[state.lang]), '. ',
                        state.lang === 'es'
                            ? 'Cambiá el idioma arriba para editar las traducciones.'
                            : 'Debajo de cada campo ves el texto en español como referencia.'))
            ),
            ...view.render()
        );
        $('#editor').scrollTop = scroll;
    }

    function setView(id) {
        state.view = id;
        renderTabs();
        renderEditor();
        $('#editor').scrollTop = 0;
        loadPreviewPage();
    }

    function setLang(l) {
        state.lang = l;
        updateLangBadges();
        renderEditor();
        schedulePreview(0);
    }

    // ------------------------------------------------------------------ vista previa
    let previewReady = false, previewTimer = null;

    function loadPreviewPage() {
        previewReady = false;
        const page = VIEWS[state.view].page;
        const iframe = $('#previewIframe');
        const target = page + '?preview=1';
        if (iframe.getAttribute('src') !== target) iframe.setAttribute('src', target);
        else { previewReady = true; schedulePreview(0); }
        $('#openSite').href = page;
    }

    function schedulePreview(delay = 250) {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(sendPreview, delay);
    }

    function sendPreview() {
        const iframe = $('#previewIframe');
        if (!previewReady || !iframe.contentWindow) return;
        iframe.contentWindow.postMessage({ type: 'cj-preview', content: state.draft, lang: state.lang }, location.origin);
    }

    window.addEventListener('message', e => {
        if (e.origin !== location.origin || !e.data || e.data.type !== 'cj-preview-ready') return;
        previewReady = true;
        sendPreview();
    });

    function layoutPreview() {
        const stage = $('#previewStage');
        const frame = $('#previewFrame');
        const mobile = state.device === 'mobile';
        const W = mobile ? 390 : 1440, H = mobile ? 800 : 900;
        const border = mobile ? 16 : 0;
        const availW = stage.clientWidth - 36, availH = stage.clientHeight - 36;
        if (availW <= 0 || availH <= 0) return;
        const scale = Math.min(1, availW / (W + border), availH / (H + border));
        frame.classList.toggle('mobile', mobile);
        Object.assign(frame.style, {
            width: (W + border) + 'px', height: (H + border) + 'px',
            transform: `translateX(-50%) scale(${scale})`
        });
    }

    // ------------------------------------------------------------------ estado / publicar
    const isDirty = () => state.draft && JSON.stringify(state.draft) !== JSON.stringify(state.published);

    function updateStatus() {
        const dirty = isDirty();
        const st = $('#status');
        st.classList.toggle('dirty', dirty);
        st.textContent = dirty ? 'Cambios sin publicar' : (state.updatedAt ? `Publicado ${relTime(state.updatedAt)}` : 'Contenido original del sitio');
        $('#publishBtn').disabled = !dirty;
        $('#discardBtn').hidden = !dirty;
    }
    setInterval(() => state.draft && updateStatus(), 30000);

    function saveLocalDraft() {
        try {
            if (isDirty()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: state.version, draft: state.draft, at: Date.now() }));
            else localStorage.removeItem(DRAFT_KEY);
        } catch (e) { /* almacenamiento no disponible */ }
    }

    function restoreLocalDraft() {
        try {
            const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (!saved || saved.base !== state.version) return;
            if (JSON.stringify(saved.draft) === JSON.stringify(state.published)) return;
            if (window.confirm(`Hay cambios sin publicar guardados en este navegador (${fmtDate(saved.at)}). ¿Recuperarlos?`)) {
                state.draft = saved.draft;
            } else {
                localStorage.removeItem(DRAFT_KEY);
            }
        } catch (e) { /* ignorar */ }
    }

    function validateDraft() {
        const c = state.draft;
        const problems = [];
        if (isEmail(c.home.email)) problems.push('El email no es válido.');
        if (isUrl(c.home.instagram)) problems.push('El link de Instagram tiene que empezar con https://');
        if (isUrl(c.home.facebook)) problems.push('El link de Facebook tiene que empezar con https://');
        if (!c.home.carousel.length) problems.push('El carrusel necesita al menos una foto.');
        return problems;
    }

    async function publish() {
        const problems = validateDraft();
        if (problems.length) return toast(problems[0], true);
        const missing = countMissing();
        const total = missing.en + missing.de;
        if (total && !window.confirm(`Hay ${total} textos sin traducir (EN: ${missing.en}, DE: ${missing.de}). En esos casos se va a mostrar el texto en español. ¿Publicar igual?`)) return;
        const btn = $('#publishBtn');
        btn.disabled = true;
        btn.textContent = 'Publicando…';
        try {
            const res = await api('/api/content', { method: 'PUT', body: { content: state.draft, baseVersion: state.version } });
            state.published = res.content;
            state.draft = clone(res.content);
            state.version = res.version;
            state.updatedAt = res.updatedAt;
            saveLocalDraft();
            toast('¡Publicado! El sitio se actualiza en menos de un minuto.');
            renderEditor();
        } catch (e) {
            toast(e.message, true);
        } finally {
            btn.textContent = 'Publicar';
            updateStatus();
        }
    }

    function discard() {
        if (!window.confirm('¿Descartar todos los cambios sin publicar?')) return;
        state.draft = clone(state.published);
        draftChanged();
        renderEditor();
    }

    async function openHistory() {
        const drawer = $('#historyDrawer');
        const list = $('#historyList');
        drawer.hidden = false;
        list.replaceChildren(h('li', { class: 'muted' }, 'Cargando…'));
        try {
            const { versions } = await api('/api/history');
            if (!versions.length) {
                list.replaceChildren(h('li', { class: 'muted' }, 'Todavía no se publicó nada desde el panel.'));
                return;
            }
            list.replaceChildren(...versions.map(v => h('li', null,
                h('div', { class: 'h-main' },
                    h('div', { class: 'h-date' }, fmtDate(v.created_at)),
                    h('div', { class: 'h-note' }, v.note || `Versión #${v.id}`)),
                v.id === state.version
                    ? h('span', { class: 'current' }, 'Actual')
                    : h('button', {
                        class: 'btn btn-sm', type: 'button', onclick: async () => {
                            if (isDirty() && !window.confirm('Tenés cambios sin publicar que se van a perder. ¿Continuar?')) return;
                            if (!window.confirm(`¿Volver a publicar la versión del ${fmtDate(v.created_at)}?`)) return;
                            try {
                                const res = await api('/api/history', { method: 'POST', body: { id: v.id } });
                                state.published = res.content;
                                state.draft = clone(res.content);
                                state.version = res.version;
                                state.updatedAt = res.updatedAt;
                                draftChanged();
                                renderTabs();
                                renderEditor();
                                toast('Versión restaurada y publicada.');
                                openHistory();
                            } catch (e) { toast(e.message, true); }
                        }
                    }, 'Restaurar')
            )));
        } catch (e) {
            list.replaceChildren(h('li', { class: 'field-error' }, e.message));
        }
    }

    // ------------------------------------------------------------------ inicio / sesión
    function showLogin(message) {
        $('#login').hidden = false;
        $('#app').hidden = true;
        $('#loginError').textContent = message || '';
        setTimeout(() => ($('#username').value ? $('#password') : $('#username')).focus(), 50);
    }

    async function startApp() {
        const data = await api('/api/content?fresh=1');
        const firstLoad = !state.draft;
        const keepDraft = !firstLoad && isDirty();
        state.published = data.content;
        state.version = data.version;
        state.updatedAt = data.updatedAt;
        if (!keepDraft) state.draft = clone(data.content);
        if (firstLoad) restoreLocalDraft();

        $('#login').hidden = true;
        $('#app').hidden = false;
        if (firstLoad && window.innerWidth < 760) {
            state.device = 'mobile';
            $('#deviceTabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.device === 'mobile'));
        }
        renderTabs();
        renderEditor();
        updateStatus();
        loadPreviewPage();
        requestAnimationFrame(layoutPreview);
    }

    async function init() {
        let st;
        try {
            st = await api('/api/login');
        } catch (e) {
            // Live Server u otro servidor estático: no ejecuta las funciones de /api
            if (e.status === 404 || e.status === 405 || !e.status) {
                return showLogin('El panel necesita las funciones de Vercel (/api). Live Server no las ejecuta: probalo en el sitio publicado en Vercel o con “vercel dev” (http://localhost:3000/admin).');
            }
            return showLogin('No se pudo conectar con el servidor.');
        }
        if (!st.passwordConfigured || !st.databaseConfigured) {
            const missing = [!st.passwordConfigured && 'ADMIN_PASSWORD', !st.databaseConfigured && 'DATABASE_URL'].filter(Boolean).join(' y ');
            showLogin(`Falta configurar ${missing} en Vercel (ver README).`);
            if (!st.passwordConfigured) return;
        }
        if (!st.authenticated) return showLogin(st.databaseConfigured ? '' : $('#loginError').textContent);
        try {
            await startApp();
        } catch (e) {
            showLogin(e.message);
        }
    }

    $('#loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        $('#loginError').textContent = '';
        try {
            await api('/api/login', { method: 'POST', body: { username: $('#username').value, password: $('#password').value } });
            $('#password').value = '';
            await startApp();
        } catch (err) {
            $('#loginError').textContent = err.status === 405 || err.status === 404
                ? 'Este servidor no ejecuta las funciones de /api (¿Live Server?). Usá el sitio en Vercel o “vercel dev”.'
                : err.message;
        } finally {
            btn.disabled = false;
        }
    });

    $('#publishBtn').addEventListener('click', publish);
    $('#discardBtn').addEventListener('click', discard);
    $('#historyBtn').addEventListener('click', openHistory);
    $('#historyDrawer').addEventListener('click', e => { if (e.target.closest('[data-close]')) $('#historyDrawer').hidden = true; });
    $('#logoutBtn').addEventListener('click', async () => {
        if (isDirty() && !window.confirm('Tenés cambios sin publicar. Se guardan en este navegador. ¿Salir igual?')) return;
        await api('/api/login', { method: 'DELETE' }).catch(() => {});
        showLogin('Sesión cerrada.');
    });
    $('#previewToggle').addEventListener('click', () => {
        const shown = $('#app').classList.toggle('show-preview');
        $('#previewToggle').textContent = shown ? 'Cerrar vista previa' : 'Vista previa';
        requestAnimationFrame(layoutPreview);
    });
    $('#deviceTabs').addEventListener('click', e => {
        const b = e.target.closest('button[data-device]');
        if (!b) return;
        state.device = b.dataset.device;
        $('#deviceTabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        layoutPreview();
    });
    window.addEventListener('resize', layoutPreview);
    if ('ResizeObserver' in window) new ResizeObserver(layoutPreview).observe($('#previewStage'));
    window.addEventListener('beforeunload', e => {
        if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
    });

    init();
})();
