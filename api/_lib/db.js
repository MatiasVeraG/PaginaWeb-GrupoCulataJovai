// Conexión a Postgres (Railway). Configurar DATABASE_URL en Vercel con la URL pública de Railway.
const { httpError } = require('./http');

let pool = null;
let ready = null;

function isConfigured() {
    return Boolean(process.env.DATABASE_URL);
}

function getPool() {
    if (!isConfigured()) throw httpError(503, 'Falta configurar DATABASE_URL en Vercel');
    if (!pool) {
        const { Pool } = require('pg');
        const url = process.env.DATABASE_URL;
        const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
        pool = new Pool({
            connectionString: url,
            // El proxy público de Railway usa TLS con certificado propio.
            ssl: local || process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
            max: 3,
            idleTimeoutMillis: 10_000,
            connectionTimeoutMillis: 8_000
        });
    }
    return pool;
}

async function query(sql, params = []) {
    const p = getPool();
    if (!ready) {
        ready = p.query(`
            CREATE TABLE IF NOT EXISTS cj_content (
                id SERIAL PRIMARY KEY,
                data JSONB NOT NULL,
                note TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS cj_images (
                id TEXT PRIMARY KEY,
                mime TEXT NOT NULL,
                data BYTEA NOT NULL,
                width INT,
                height INT,
                bytes INT,
                original_name TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `).catch(err => { ready = null; throw err; });
    }
    await ready;
    return p.query(sql, params);
}

module.exports = { query, isConfigured };
