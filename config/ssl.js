const { parse } = require('pg-connection-string');
const { logger } = require('../middlewares/logger');

/*
  Central SSL policy for every Postgres connection (app pool + pg-boss).

  Resolution order:
    1. Localhost targets never use TLS.
    2. PGSSLSTRICT=false  → encrypt but skip certificate validation (escape hatch).
       PGSSLSTRICT=true   → full validation, fail loudly on untrusted chains.
    3. sslmode in DATABASE_URL wins next (libpq semantics):
         require / prefer / allow / no-verify → encrypt, skip validation
         verify-ca / verify-full              → full validation
    4. PGSSLROOTCERT (PEM string) pins the CA → full validation against it.
    5. Nothing specified, remote host → encrypt + skip validation, WARN once so
       operators are pushed toward pinned-CA verification instead of silently
       staying unprotected.
*/

let warned = false;

function resolveSsl(databaseUrl, env = process.env) {
  if (!databaseUrl) return false;

  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  if (isLocal) return false;

  // 2. Explicit operator override.
  if (env.PGSSLSTRICT === 'false') return { rejectUnauthorized: false };
  if (env.PGSSLSTRICT === 'true') return { rejectUnauthorized: true };

  let mode;
  try {
    const parsed = parse(databaseUrl);
    mode = parsed.sslmode || parsed.ssl_mode || null;
  } catch (err) {
    mode = null;
  }

  // 4. Pinned CA beats URL modes — it is the strongest setup.
  if (env.PGSSLROOTCERT) {
    return { ca: env.PGSSLROOTCERT, rejectUnauthorized: true };
  }

  // 3. libpq-style sslmode from the connection string.
  if (mode) {
    const m = String(mode).toLowerCase();
    if (m === 'disable' || m === 'false') return false;
    if (m === 'verify-ca' || m === 'verify-full') return { rejectUnauthorized: true };
    if (m === 'require' || m === 'prefer' || m === 'allow' || m === 'no-verify') {
      return { rejectUnauthorized: false };
    }
  }

  // 5. Unmanaged default: encrypted, unvalidated, loud.
  if (!warned) {
    logger.warn(
      'Postgres TLS certificate validation is DISABLED (untrusted host chain). ' +
      'Set PGSSLROOTCERT to the provider CA, or append ?sslmode=verify-full with PGSSLROOTCERT, to enable verified TLS.'
    );
    warned = true;
  }
  return { rejectUnauthorized: false };
}

module.exports = { resolveSsl };
