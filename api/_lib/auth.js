const crypto = require('crypto');
const { parseCookies, httpError } = require('./http');
const { query, isConfigured } = require('./db');

const COOKIE = 'cj_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días
const MIN_LENGTH = 10;

// La firma de las sesiones usa SESSION_SECRET o, si no existe, ADMIN_PASSWORD de Vercel.
// (Por eso ADMIN_PASSWORD tiene que seguir cargada aunque la contraseña se cambie desde el panel.)
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

// ---------- Contraseña cambiada desde el panel (guardada cifrada en la base)
function hashPassword(password, salt) {
    return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

async function getStoredPassword() {
    if (!isConfigured()) return null;
    const { rows } = await query("SELECT value FROM cj_settings WHERE key = 'admin_password'");
    return rows.length ? rows[0].value : null;
}

// Recuperación: con RESET_ADMIN_PASSWORD=1 en Vercel se borra la contraseña del panel
// y vuelve a valer ADMIN_PASSWORD.
async function currentPassword() {
    let stored = await getStoredPassword();
    if (stored && process.env.RESET_ADMIN_PASSWORD === '1') {
        await query("DELETE FROM cj_settings WHERE key = 'admin_password'");
        stored = null;
    }
    return stored;
}

// "Versión" de la contraseña: forma parte de la firma de la sesión,
// así al cambiar la contraseña se cierran las demás sesiones.
function versionOf(stored) {
    return stored ? stored.v : 'env';
}

async function passwordConfigured() {
    if (process.env.ADMIN_PASSWORD) return true;
    try { return Boolean(await getStoredPassword()); } catch (e) { return false; }
}

async function checkCredentials(username, password) {
    if (!secret()) return { ok: false };
    const stored = await currentPassword();
    const userOk = safeEqual(normalizeUser(username), adminUser());
    let passOk;
    if (stored) passOk = safeEqual(hashPassword(password || '', stored.salt), stored.hash);
    else passOk = Boolean(process.env.ADMIN_PASSWORD) && safeEqual(password || '', process.env.ADMIN_PASSWORD);
    return { ok: userOk && passOk, version: versionOf(stored) };
}

async function changePassword(current, next) {
    const check = await checkCredentials(adminUser(), current);
    if (!check.ok) throw httpError(400, 'La contraseña actual no es correcta');
    next = String(next || '');
    if (next.length < MIN_LENGTH) throw httpError(400, `La contraseña nueva tiene que tener al menos ${MIN_LENGTH} caracteres`);
    if (next.length > 200) throw httpError(400, 'La contraseña nueva es demasiado larga');
    if (next === current) throw httpError(400, 'La contraseña nueva tiene que ser distinta de la actual');
    const salt = crypto.randomBytes(16).toString('hex');
    const value = { salt, hash: hashPassword(next, salt), v: crypto.randomBytes(8).toString('hex'), changedAt: new Date().toISOString() };
    await query(
        `INSERT INTO cj_settings (key, value, updated_at) VALUES ('admin_password', $1::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [JSON.stringify(value)]
    );
    return value.v;
}

// ---------- Sesión (cookie firmada)
function isSecure(req) {
    const proto = req.headers['x-forwarded-proto'];
    if (proto) return proto.split(',')[0].trim() === 'https';
    const host = req.headers.host || '';
    return !/^(localhost|127\.0\.0\.1)(:|$)/.test(host);
}

function sessionCookie(req, version) {
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const value = exp + '.' + sign(exp + '.' + version);
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}` + (isSecure(req) ? '; Secure' : '');
}

function clearCookie(req) {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` + (isSecure(req) ? '; Secure' : '');
}

async function isAuthed(req) {
    if (!secret()) return false;
    const raw = parseCookies(req)[COOKIE];
    if (!raw) return false;
    const [exp, sig] = raw.split('.');
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
    let stored;
    try { stored = await getStoredPassword(); } catch (e) { return false; }
    if (safeEqual(sig, sign(exp + '.' + versionOf(stored)))) return true;
    // Sesiones abiertas antes de esta versión del panel (firma sin versión):
    // siguen valiendo mientras la contraseña no se haya cambiado desde el panel.
    return !stored && safeEqual(sig, sign(exp));
}

async function requireAuth(req) {
    if (!(await isAuthed(req))) throw httpError(401, 'Sesión vencida. Volvé a ingresar.');
}

module.exports = { checkCredentials, changePassword, passwordConfigured, sessionCookie, clearCookie, isAuthed, requireAuth, MIN_LENGTH };
