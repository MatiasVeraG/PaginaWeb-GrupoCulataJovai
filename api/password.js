// POST /api/password → { current, next } cambia la contraseña del panel (requiere sesión).
// La nueva se guarda cifrada en la base; las demás sesiones abiertas se cierran.
const { send, readJson, httpError, assertSameOrigin, handler } = require('./_lib/http');
const { requireAuth, changePassword, sessionCookie } = require('./_lib/auth');

module.exports = handler(async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        throw httpError(405, 'Método no permitido');
    }
    assertSameOrigin(req);
    await requireAuth(req);
    const { current, next } = await readJson(req, 10_000);
    const version = await changePassword(current, next);
    // La sesión actual sigue abierta con la firma nueva
    return send(res, 200, { changed: true }, { 'Set-Cookie': sessionCookie(req, version) });
});
