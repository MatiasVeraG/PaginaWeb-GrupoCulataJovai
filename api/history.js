// GET  /api/history        → últimas versiones publicadas (requiere sesión)
// POST /api/history {id}   → vuelve a publicar una versión anterior
const { send, readJson, httpError, assertSameOrigin, handler } = require('./_lib/http');
const { requireAuth } = require('./_lib/auth');
const { query } = require('./_lib/db');

module.exports = handler(async (req, res) => {
    await requireAuth(req);
    if (req.method === 'GET') {
        const { rows } = await query('SELECT id, note, created_at FROM cj_content ORDER BY id DESC LIMIT 50');
        return send(res, 200, { versions: rows });
    }
    if (req.method === 'POST') {
        assertSameOrigin(req);
        const { id } = await readJson(req, 10_000);
        const { rows } = await query('SELECT data, created_at FROM cj_content WHERE id = $1', [Number(id)]);
        if (!rows.length) throw httpError(404, 'Versión no encontrada');
        const when = new Date(rows[0].created_at).toISOString().slice(0, 16).replace('T', ' ');
        const inserted = await query(
            'INSERT INTO cj_content (data, note) VALUES ($1::jsonb, $2) RETURNING id, created_at',
            [JSON.stringify(rows[0].data), `Restaurada la versión #${Number(id)} (${when} UTC)`]
        );
        return send(res, 200, { content: rows[0].data, version: inserted.rows[0].id, updatedAt: inserted.rows[0].created_at });
    }
    res.setHeader('Allow', 'GET, POST');
    throw httpError(405, 'Método no permitido');
});
