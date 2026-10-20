// GET    /api/login → ¿hay sesión? ¿está configurado el servidor?
// POST   /api/login → { username, password } inicia sesión (cookie HttpOnly)
// DELETE /api/login → cierra sesión
const { send, readJson, httpError, assertSameOrigin, handler } = require('./_lib/http');
const { checkCredentials, sessionCookie, clearCookie, isAuthed } = require('./_lib/auth');
const { isConfigured } = require('./_lib/db');

module.exports = handler(async (req, res) => {
    if (req.method === 'GET') {
        return send(res, 200, {
            authenticated: isAuthed(req),
            passwordConfigured: Boolean(process.env.ADMIN_PASSWORD),
            databaseConfigured: isConfigured()
        });
    }
    if (req.method === 'POST') {
        assertSameOrigin(req);
        if (!process.env.ADMIN_PASSWORD) throw httpError(503, 'Falta configurar ADMIN_PASSWORD en Vercel');
        const { username, password } = await readJson(req, 10_000);
        if (!checkCredentials(username, password)) {
            await new Promise(r => setTimeout(r, 800)); // frena intentos por fuerza bruta
            throw httpError(401, 'Usuario o contraseña incorrectos');
        }
        return send(res, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(req) });
    }
    if (req.method === 'DELETE') {
        return send(res, 200, { authenticated: false }, { 'Set-Cookie': clearCookie(req) });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    throw httpError(405, 'Método no permitido');
});
