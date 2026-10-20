// GET /api/img/<id>.<ext> (reescrito a /api/img?file=...) → sirve una imagen subida desde el panel.
// Cada imagen tiene un id único que nunca cambia, así que se cachea en el CDN por un año.
const { send, getQuery, httpError, handler } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = handler(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Método no permitido');
    const file = getQuery(req).file || '';
    const m = /^([a-f0-9]{8,40})(\.\w+)?$/.exec(file);
    if (!m) throw httpError(404, 'Imagen no encontrada');
    const { rows } = await query('SELECT mime, data FROM cj_images WHERE id = $1', [m[1]]);
    if (!rows.length) throw httpError(404, 'Imagen no encontrada');
    const data = Buffer.isBuffer(rows[0].data) ? rows[0].data : Buffer.from(rows[0].data);
    send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : data, {
        'Content-Type': rows[0].mime,
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
    });
});
