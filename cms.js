// Carga el contenido editado desde el panel /admin.
// Si la API no responde (o se abre el HTML directo desde la computadora), la página
// sigue mostrando el contenido escrito en el HTML.
(function () {
    const LANGS = ['es', 'en', 'de'];
    const params = new URLSearchParams(location.search);
    const inAdminPreview = params.get('preview') === '1' && window.parent !== window;

    function tr(value, lang) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return value[lang] || value.es || '';
    }

    function load(timeoutMs = 3500) {
        if (location.protocol === 'file:') return Promise.resolve(null);
        const ctrl = 'AbortController' in window ? new AbortController() : null;
        const timer = setTimeout(() => ctrl && ctrl.abort(), timeoutMs);
        return fetch('/api/content', { signal: ctrl ? ctrl.signal : undefined })
            .then(r => (r.ok ? r.json() : null))
            .then(d => (d && d.content) || null)
            .catch(() => null)
            .finally(() => clearTimeout(timer));
    }

    // Vista previa en vivo dentro del panel: el panel envía el borrador por postMessage.
    function onPreview(callback) {
        if (!inAdminPreview) return;
        window.addEventListener('message', e => {
            if (e.origin !== location.origin || !e.data || e.data.type !== 'cj-preview') return;
            callback(e.data.content, e.data.lang);
        });
        window.parent.postMessage({ type: 'cj-preview-ready' }, location.origin);
    }

    function telHref(phone) {
        return 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
    }

    function savedLang() {
        try {
            const l = localStorage.getItem('selectedLanguage');
            return LANGS.includes(l) ? l : 'es';
        } catch (e) {
            return 'es';
        }
    }

    // Disposición de una foto dentro de su espacio:
    //   cover   = Llenar (ocupa todo, recorta)
    //   contain = Completar (entera, con márgenes)
    //   height  = Completar vertical (todo el alto visible)
    //   width   = Completar horizontal (todo el ancho visible)
    function fitMode(fit, iw, ih, fw, fh) {
        if (fit === 'contain') return 'contain';
        if (fit === 'height') return iw / ih > fw / fh ? 'cover' : 'contain';
        if (fit === 'width') return iw / ih < fw / fh ? 'cover' : 'contain';
        return 'cover';
    }

    // Aplica disposición, encuadre (pos) y zoom a una <img>. Devuelve una función para recalcular al cambiar el tamaño.
    function layoutImage(img, item) {
        const pos = item.pos || '50% 50%';
        const zoom = Number(item.zoom) || 1;
        img.style.objectPosition = pos;
        img.style.transformOrigin = pos;
        img.style.transform = zoom !== 1 ? 'scale(' + zoom + ')' : '';
        img.style.objectFit = item.fit === 'contain' ? 'contain' : 'cover';
        const update = () => {
            const box = img.parentElement;
            if (!img.naturalWidth || !box || !box.clientHeight) return;
            img.style.objectFit = fitMode(item.fit, img.naturalWidth, img.naturalHeight, box.clientWidth, box.clientHeight);
        };
        if (img.complete) update(); else img.addEventListener('load', update, { once: true });
        return update;
    }

    window.CMS = { LANGS, tr, load, onPreview, telHref, savedLang, inAdminPreview, fitMode, layoutImage };
})();
