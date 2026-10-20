// Utilidades HTTP mínimas, compatibles con las funciones de Vercel (Node) y con Node puro.

function send(res, status, body, headers = {}) {
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    if (Buffer.isBuffer(body)) {
        res.end(body);
        return;
    }
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
    res.end(body === undefined ? '' : JSON.stringify(body));
}

function getQuery(req) {
    const url = new URL(req.url, 'http://x');
    return Object.fromEntries(url.searchParams.entries());
}

// Lee el cuerpo JSON. Vercel puede haberlo parseado ya (req.body); si no, se lee del stream.
async function readJson(req, limitBytes = 1_000_000) {
    if (req.body !== undefined && req.body !== null && req.body !== '') {
        if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
        const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
        if (text.length > limitBytes) throw httpError(413, 'Archivo demasiado grande');
        return JSON.parse(text);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limitBytes) throw httpError(413, 'Archivo demasiado grande');
        chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
}

function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function parseCookies(req) {
    const out = {};
    const header = req.headers.cookie || '';
    header.split(';').forEach(part => {
        const i = part.indexOf('=');
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

// Protección CSRF básica: las peticiones que modifican datos deben venir del mismo sitio.
function assertSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    try {
        if (new URL(origin).host !== host) throw httpError(403, 'Origen no permitido');
    } catch (e) {
        if (e.status) throw e;
        throw httpError(403, 'Origen no permitido');
    }
}

// Envuelve un handler para responder errores como JSON.
function handler(fn) {
    return async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            const status = err.status || 500;
            if (status >= 500) console.error(err);
            // Los errores inesperados no muestran detalles internos.
            const message = err.status ? err.message : 'Error del servidor. Probá de nuevo en un momento.';
            send(res, status, { error: message });
        }
    };
}

module.exports = { send, getQuery, readJson, httpError, parseCookies, assertSameOrigin, handler };
