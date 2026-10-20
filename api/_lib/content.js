// Estructura del contenido editable y su validación.
const defaults = require('./defaults.json');
const { query, isConfigured } = require('./db');
const { httpError } = require('./http');

const LANGS = ['es', 'en', 'de'];

const clean = (v, max) => String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, max);

const tr = (v, max = 4000) => {
    const src = v && typeof v === 'object' ? v : {};
    return Object.fromEntries(LANGS.map(l => [l, clean(src[l], max)]));
};

const url = (v, fallback = '') => {
    const s = clean(v, 500).trim();
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : (s === '' ? '' : fallback);
};

const IMG_RE = /^(images\/[\w\-./]+\.(jpe?g|png|webp|avif|gif|svg)|\/api\/img\/[a-f0-9]{8,40}\.(webp|jpg|png|avif))$/i;
const imgSrc = (v, fallback) => {
    const s = clean(v, 300).trim();
    return IMG_RE.test(s) && !s.includes('..') ? s : fallback;
};

const pos = v => {
    const s = clean(v, 20).trim();
    return /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(s) ? s : '50% 50%';
};

function sanitize(input) {
    const c = input && typeof input === 'object' ? input : {};
    const d = defaults;
    const g = c.global || {}, h = c.home || {}, s = c.sobre || {};
    const labels = h.labels || {};

    const carousel = (Array.isArray(h.carousel) ? h.carousel : [])
        .slice(0, 80)
        .map(item => ({
            src: imgSrc(item && item.src, null),
            title: clean(item && item.title, 200),
            pos: pos(item && item.pos),
            fit: item && item.fit === 'contain' ? 'contain' : 'cover'
        }))
        .filter(item => item.src);
    if (!carousel.length) throw httpError(400, 'El carrusel necesita al menos una foto');

    const paragraphs = (Array.isArray(s.paragraphs) ? s.paragraphs : [])
        .slice(0, 40)
        .map(p => tr(p, 6000));

    return {
        global: {
            logo: {
                src: imgSrc(g.logo && g.logo.src, d.global.logo.src),
                alt: clean(g.logo && g.logo.alt, 200) || d.global.logo.alt
            }
        },
        home: {
            labels: {
                address: tr(labels.address, 100),
                phone: tr(labels.phone, 100),
                about: tr(labels.about, 100)
            },
            address: tr(h.address, 300),
            email: clean(h.email, 200).trim(),
            phone: clean(h.phone, 60).trim(),
            instagram: url(h.instagram, d.home.instagram),
            facebook: url(h.facebook, d.home.facebook),
            carousel
        },
        sobre: {
            title: tr(s.title, 200),
            description: tr(s.description, 400),
            image: {
                src: imgSrc(s.image && s.image.src, d.sobre.image.src),
                alt: tr(s.image && s.image.alt, 300),
                pos: pos(s.image && s.image.pos)
            },
            paragraphs
        }
    };
}

async function getCurrent() {
    if (!isConfigured()) return { content: defaults, version: 0, updatedAt: null, configured: false };
    const { rows } = await query('SELECT id, data, created_at FROM cj_content ORDER BY id DESC LIMIT 1');
    if (!rows.length) return { content: defaults, version: 0, updatedAt: null, configured: true };
    return { content: rows[0].data, version: rows[0].id, updatedAt: rows[0].created_at, configured: true };
}

module.exports = { sanitize, getCurrent, defaults, LANGS };
