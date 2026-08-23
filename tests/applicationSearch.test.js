jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn(), on: jest.fn() }));

const pool = require('../config/db');
const applicationQuery = require('../models/applicationQuery');

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('full-text search in application queries (D1)', () => {
  test('q is matched through parameterized websearch_to_tsquery, never string interpolation', async () => {
    await applicationQuery.findAllSorted(3, { q: 'react AND "remote" OR kubernetes' });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/search_vector @@ websearch_to_tsquery\('english', \$2\)/);
    expect(params).toEqual([3, 'react AND "remote" OR kubernetes']);
    expect(sql).not.toContain('react'); // input stays out of the SQL text
  });

  test('no q means no FTS clause and a single userId param', async () => {
    await applicationQuery.findAllSorted(3, {});

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/websearch_to_tsquery/);
    expect(params).toEqual([3]);
  });

  test('blank q values are ignored like absent ones', async () => {
    await applicationQuery.findAllSorted(3, { q: '   ' });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([3]);
  });

  test('filters and search compose with correct parameter numbering', async () => {
    await applicationQuery.findAllSorted(3, { q: 'rust', filters: { status: 'Applied' } });

    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([3, '%Applied%', 'rust']);
    expect(sql).toMatch(/ILIKE \$2/);
    expect(sql).toMatch(/websearch_to_tsquery\('english', \$3\)/);
  });
});
