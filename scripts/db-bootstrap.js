// =========================================================================
// db-bootstrap.js — Auto-heal de la tabla "migrations" de TypeORM.
// =========================================================================
//
// Se ejecuta ANTES de arrancar la app (vía entrypoint.sh). Soluciona el
// problema clásico de: "synchronize=true creó el schema, ahora cambiamos
// a migrations y la primera migración choca contra tablas que ya existen".
//
// Lógica:
//   1) Crea la tabla `migrations` si no existe.
//   2) Si ya tiene filas → no hace nada (TypeORM toma el control normal).
//   3) Si está vacía → revisa cada archivo de migración:
//        - Si crea tablas y TODAS ya existen en la BD → la marca aplicada.
//        - Si crea tablas y al menos una NO existe → la deja pendiente.
//        - Si no crea tablas (solo ALTER) → la marca aplicada (asumiendo
//          que synchronize ya aplicó el cambio).
//
// Después de la primera corrida, futuros deploys solo registran las
// migraciones realmente nuevas. Auto-curativo y sin manual intervention.
// =========================================================================

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'dist', 'database', 'migrations');

function log(level, msg) {
    const prefix = { info: 'ℹ', ok: '✓', warn: '⚠', err: '✗' }[level] ?? '·';
    console.log(`[db-bootstrap] ${prefix} ${msg}`);
}

/**
 * Lee los archivos de migración compilados y deriva metadatos.
 * Filename pattern: <timestamp>-<ShortName>.js
 * Class name según TypeORM:   <ShortName><timestamp>
 */
function discoverMigrations() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        log('warn', `No existe ${MIGRATIONS_DIR}`);
        return [];
    }
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.js'))
        .map((file) => {
            const m = file.match(/^(\d+)-(.+)\.js$/);
            if (!m) return null;
            const [, ts, shortName] = m;
            return {
                filename: file,
                fullPath: path.join(MIGRATIONS_DIR, file),
                timestamp: parseInt(ts, 10),
                name: `${shortName}${ts}`,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp);
}

/** Extrae los nombres de tabla creados por CREATE TABLE en el archivo. */
function extractCreatedTables(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"|')?(\w+)(?:"|')?/gi;
    const tables = new Set();
    let m;
    while ((m = re.exec(content)) !== null) {
        tables.add(m[1]);
    }
    return [...tables];
}

async function tableExists(client, name) {
    const r = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [name],
    );
    return r.rowCount > 0;
}

async function connectWithRetry() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    };

    const maxAttempts = 20;
    for (let i = 1; i <= maxAttempts; i++) {
        const client = new Client(config);
        try {
            await client.connect();
            return client;
        } catch (err) {
            await client.end().catch(() => {});
            if (i === maxAttempts) {
                throw new Error(
                    `No se pudo conectar a Postgres tras ${maxAttempts} intentos: ${err.message}`,
                );
            }
            log('info', `Esperando a Postgres (intento ${i}/${maxAttempts})...`);
            await new Promise((res) => setTimeout(res, 1500));
        }
    }
}

async function main() {
    const client = await connectWithRetry();
    try {
        // 1) Asegurar la tabla `migrations`
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                timestamp bigint NOT NULL,
                name varchar NOT NULL
            )
        `);

        // 2) ¿Ya hay tracking de migraciones? Entonces no tocamos nada.
        const tracked = await client.query('SELECT name FROM migrations');
        if (tracked.rowCount > 0) {
            log('info', `Migraciones tracked: ${tracked.rowCount}. Sin intervención necesaria.`);
            return;
        }

        // 3) ¿Hay schema preexistente? Detectamos por presencia de "users"
        //    (la primera tabla que crea InitialSchema). Si no existe, asumimos
        //    BD virgen y TypeORM correrá todas las migraciones limpiamente.
        if (!(await tableExists(client, 'users'))) {
            log('info', 'BD vacía → TypeORM correrá todas las migraciones desde cero.');
            return;
        }

        // 4) Schema preexistente. Revisamos cada migración.
        const all = discoverMigrations();
        if (all.length === 0) {
            log('warn', 'No se encontraron archivos de migración compilados.');
            return;
        }

        log('info', `Schema preexistente detectado. Reconciliando ${all.length} migración(es)...`);

        for (const mig of all) {
            const createdTables = extractCreatedTables(mig.fullPath);
            let markApplied;
            let reason;

            if (createdTables.length === 0) {
                // Solo ALTER: asumimos que synchronize ya aplicó el cambio.
                markApplied = true;
                reason = 'solo ALTER (asumida aplicada por synchronize)';
            } else {
                const exists = await Promise.all(
                    createdTables.map((t) => tableExists(client, t)),
                );
                const allExist = exists.every(Boolean);
                if (allExist) {
                    markApplied = true;
                    reason = `tablas ya existen: ${createdTables.join(', ')}`;
                } else {
                    markApplied = false;
                    const missing = createdTables.filter((_, i) => !exists[i]);
                    reason = `pendiente (faltan: ${missing.join(', ')})`;
                }
            }

            if (markApplied) {
                await client.query(
                    'INSERT INTO migrations (timestamp, name) VALUES ($1, $2)',
                    [mig.timestamp, mig.name],
                );
                log('ok', `${mig.name} → marcada aplicada (${reason})`);
            } else {
                log('info', `${mig.name} → ${reason}, TypeORM la ejecutará`);
            }
        }

        log('ok', 'Reconciliación completa. TypeORM correrá las pendientes en breve.');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('[db-bootstrap] ✗ Error fatal:', err.message);
    process.exit(1);
});
