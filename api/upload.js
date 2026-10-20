// POST /api/upload → { data: base64, mime, width, height, name }  (requiere sesión de admin)
// Las imágenes llegan ya optimizadas desde el panel (redimensionadas y comprimidas en el navegador).
const crypto = require('crypto');
const { send, readJson, httpError, assertSameOrigin, handler } = require('./_lib/http');
const { requireAuth } = require('./_lib/auth');
const { query } = require('./_lib/db');

const MAX_BYTES = 3 * 1024 * 1024; // Vercel limita el cuerpo a 4,5 MB; en base64 esto ocupa ~4 MB
const TYPES = {
    'image/webp': { ext: 'webp', magic: b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
    'image/jpeg': { ext: 'jpg', magic: b => b[0] === 0xff && b[1] === 0xd8 },
    'image/png': { ext: 'png', magic: b => b.slice(1, 4).toString() === 'PNG' },
    'image/avif': { ext: 'avif', magic: b => b.slice(4, 12).toString().startsWith('ftypavi') }
};

module.exports = handler(async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        throw httpError(405, 'Método no permitido');
    }
    assertSameOrigin(req);
    requireAuth(req);
    const body = await readJson(req, Math.ceil(MAX_BYTES * 1.4) + 10_000);
    const type = TYPES[body.mime];
    if (!type) throw httpError(400, 'Formato no admitido. Usá WebP, JPG, PNG o AVIF.');
    const buf = Buffer.from(String(body.data || ''), 'base64');
    if (!buf.length) throw httpError(400, 'Imagen vacía');
    if (buf.length > MAX_BYTES) throw httpError(413, 'La imagen pesa más de 3 MB. Bajá la calidad o el tamaño.');
    if (!type.magic(buf)) throw httpError(400, 'El archivo no coincide con el formato indicado');

    const id = crypto.randomBytes(8).toString('hex');
    const width = Number.isInteger(body.width) ? body.width : null;
    const height = Number.isInteger(body.height) ? body.height : null;
    await query(
        'INSERT INTO cj_images (id, mime, data, width, height, bytes, original_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, body.mime, buf, width, height, buf.length, String(body.name || '').slice(0, 200)]
    );
    return send(res, 200, { src: `/api/img/${id}.${type.ext}`, bytes: buf.length, width, height });
});
