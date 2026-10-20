const crypto = require('crypto');
const { parseCookies, httpError } = require('./http');

const COOKIE = 'cj_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function secret() {
    return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(value) {
    return crypto.createHmac('sha256', secret()).update('cj-admin.' + value).digest('base64url');
}

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Usuario: se puede cambiar con la variable ADMIN_USER (por defecto "admin").
// No distingue mayúsculas ni espacios de más.
const normalizeUser = u => String(u || '').trim().replace(/\s+/g, ' ').toLowerCase();

function adminUser() {
    return normalizeUser(process.env.ADMIN_USER || 'admin');
}

function checkCredentials(username, password) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return false;
    const userOk = safeEqual(normalizeUser(username), adminUser());
    const passOk = safeEqual(password || '', expected);
    return userOk && passOk;
}

function isSecure(req) {
    const proto = req.headers['x-forwarded-proto'];
    if (proto) return proto.split(',')[0].trim() === 'https';
    const host = req.headers.host || '';
    return !/^(localhost|127\.0\.0\.1)(:|$)/.test(host);
}

function sessionCookie(req) {
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const value = exp + '.' + sign(String(exp));
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}` + (isSecure(req) ? '; Secure' : '');
}

function clearCookie(req) {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` + (isSecure(req) ? '; Secure' : '');
}

function isAuthed(req) {
    if (!secret()) return false;
    const raw = parseCookies(req)[COOKIE];
    if (!raw) return false;
    const [exp, sig] = raw.split('.');
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
    return safeEqual(sig, sign(exp));
}

function requireAuth(req) {
    if (!isAuthed(req)) throw httpError(401, 'Sesión vencida. Volvé a ingresar.');
}

module.exports = { checkCredentials, sessionCookie, clearCookie, isAuthed, requireAuth };
