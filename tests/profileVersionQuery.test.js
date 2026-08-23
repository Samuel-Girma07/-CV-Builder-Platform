process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  withTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
}));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const pool = require('../config/db');
const profileVersionQuery = require('../models/profileVersionQuery');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockReset();
});

describe('profile version snapshots', () => {
  test('createSnapshot validates triggers and stores JSON payloads', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };

    const snap = await profileVersionQuery.createSnapshot(tx, 3, { skills: ['Go'] }, 'ai_parse', 42);

    expect(snap.id).toBe(1);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO profile_versions/);
    expect(params).toEqual([3, JSON.stringify({ skills: ['Go'] }), 'ai_parse', 42]);
  });

  test('unknown triggers are rejected before touching the database', async () => {
    const tx = { query: jest.fn() };
    await expect(
      profileVersionQuery.createSnapshot(tx, 3, {}, 'banana')
    ).rejects.toThrow(/Unknown profile version trigger/i);
    expect(tx.query).not.toHaveBeenCalled();
  });

  test('prune keeps only the newest MAX_PROFILE_VERSIONS rows per user', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await profileVersionQuery.prune(tx, 3);

    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM profile_versions/);
    expect(sql).toMatch(/LIMIT \$2/);
    expect(params).toEqual([3, profileVersionQuery.MAX_PROFILE_VERSIONS]);
    expect(profileVersionQuery.MAX_PROFILE_VERSIONS).toBe(50);
  });

  test('listByUser returns metadata only, newest first, hard-capped at 100', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });

    await profileVersionQuery.listByUser(3, 500);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/\*/);
    expect(sql).toMatch(/ORDER BY created_at DESC/);
    expect(params).toEqual([3, 100]);
  });
});
