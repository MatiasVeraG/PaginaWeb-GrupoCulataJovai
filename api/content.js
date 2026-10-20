// GET  /api/content  → contenido publicado (público, cacheado unos segundos en el CDN)
// PUT  /api/content  → guarda y publica una nueva versión (requiere sesión de admin)
const { send, getQuery, readJson, httpError, assertSameOrigin, handler } = require('./_lib/http');
const { requireAuth } = require('./_lib/auth');
const { query } = require('./_lib/db');
const { sanitize, getCurrent } = require('./_lib/content');

const KEEP_VERSIONS = 50;

module.exports = handler(async (req, res) => {
    if (req.method === 'GET') {
        const fresh = 'fresh' in getQuery(req);
        let current;
        try {
            current = await getCurrent();
        } catch (err) {
            console.error(err);
            throw httpError(503, 'No se pudo conectar con la base de datos. Revisá DATABASE_URL en Vercel.');
        }
        return send(res, 200, current, {
            'Cache-Control': fresh
                ? 'no-store'
                : 'public, max-age=0, s-maxage=20, stale-while-revalidate=600'
        });
    }

    if (req.method === 'PUT') {
        assertSameOrigin(req);
        requireAuth(req);
        const body = await readJson(req, 2_000_000);
        const content = sanitize(body.content);
        const current = await getCurrent();
        if (body.baseVersion !== undefined && Number(body.baseVersion) !== current.version) {
            throw httpError(409, 'Alguien publicó cambios mientras editabas. Recargá la página para ver la última versión.');
        }
        const note = String(body.note || '').slice(0, 200) || null;
        const { rows } = await query(
            'INSERT INTO cj_content (data, note) VALUES ($1::jsonb, $2) RETURNING id, created_at',
            [JSON.stringify(content), note]
        );
        await query(
            'DELETE FROM cj_content WHERE id NOT IN (SELECT id FROM cj_content ORDER BY id DESC LIMIT ' + KEEP_VERSIONS + ')'
        );
        return send(res, 200, { content, version: rows[0].id, updatedAt: rows[0].created_at });
    }

    res.setHeader('Allow', 'GET, PUT');
    throw httpError(405, 'Método no permitido');
});
