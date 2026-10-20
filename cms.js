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

    window.CMS = { LANGS, tr, load, onPreview, telHref, savedLang, inAdminPreview };
})();
