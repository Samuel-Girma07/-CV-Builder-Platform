process.env.JWT_SECRET = 'test-secret';

jest.mock('../middlewares/logger', () => {
  const warn = jest.fn();
  return { logger: { info: jest.fn(), warn, error: jest.fn() }, requestLogger: jest.fn(), __warn: warn };
});

const { resolveSsl } = require('../config/ssl');
const { logger } = require('../middlewares/logger');

const SUPABASE_LIKE = 'postgresql://user:pass@db.abcd.supabase.co:5432/postgres';
const POOLER = 'postgresql://user:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require';

beforeEach(() => {
  delete process.env.PGSSLSTRICT;
  delete process.env.PGSSLROOTCERT;
  logger.warn.mockClear();
});

afterAll(() => {
  delete process.env.PGSSLSTRICT;
  delete process.env.PGSSLROOTCERT;
});

describe('postgres SSL policy matrix (production incident fix)', () => {
  test('localhost and empty targets never use TLS', () => {
    expect(resolveSsl('postgresql://u:p@localhost:5432/db')).toBe(false);
    expect(resolveSsl('postgresql://u:p@127.0.0.1:5432/db')).toBe(false);
    expect(resolveSsl(undefined)).toBe(false);
  });

  test('the documented escape hatch still wins over everything', () => {
    const env = { PGSSLSTRICT: 'false' };
    expect(resolveSsl(SUPABASE_LIKE, env)).toEqual({ rejectUnauthorized: false });
  });

  test('PGSSLSTRICT=true forces validation and fails loudly on untrusted chains', () => {
    const env = { PGSSLSTRICT: 'true' };
    expect(resolveSsl(SUPABASE_LIKE, env)).toEqual({ rejectUnauthorized: true });
  });

  test('libpq sslmode semantics from the URL are honored', () => {
    expect(resolveSsl(POOLER).rejectUnauthorized).toBe(false);          // require
    expect(resolveSsl(SUPABASE_LIKE + '?sslmode=verify-full').rejectUnauthorized).toBe(true);
    expect(resolveSsl(SUPABASE_LIKE + '?sslmode=no-verify').rejectUnauthorized).toBe(false);
    expect(resolveSsl(SUPABASE_LIKE + '?sslmode=disable')).toBe(false);
  });

  test('a pinned CA upgrades any URL to verified TLS', () => {
    const env = { PGSSLROOTCERT: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----' };
    const out = resolveSsl(POOLER, env);
    expect(out.rejectUnauthorized).toBe(true);
    expect(out.ca).toContain('BEGIN CERTIFICATE');
  });

  test('unspecified remote defaults to encrypted-but-unvalidated with a loud one-time warning', () => {
    const first = resolveSsl(SUPABASE_LIKE, {});
    expect(first).toEqual({ rejectUnauthorized: false });
    expect(logger.warn).toHaveBeenCalledTimes(1);

    resolveSsl(POOLER, {});
    expect(logger.warn).toHaveBeenCalledTimes(1); // once per process, not per call
  });
});
