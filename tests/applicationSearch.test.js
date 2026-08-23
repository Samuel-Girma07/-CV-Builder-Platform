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
    // Pagination params ride along after userId + search term.
    expect(params).toEqual([3, 'react AND "remote" OR kubernetes', 25, 0]);
    expect(sql).not.toContain('react'); // input stays out of the SQL text
  });

  test('no q means no FTS clause', async () => {
    await applicationQuery.findAllSorted(3, {});

    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/websearch_to_tsquery/);
  });

  test('blank q values are ignored like absent ones', async () => {
    await applicationQuery.findAllSorted(3, { q: '   ' });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/websearch_to_tsquery/);
    expect(params.slice(0, 1)).toEqual([3]);
  });

  test('filters and search compose with correct parameter numbering', async () => {
    await applicationQuery.findAllSorted(3, { q: 'rust', filters: { status: 'Applied' } });

    const [sql, params] = pool.query.mock.calls[0];
    expect(params.slice(0, 3)).toEqual([3, '%Applied%', 'rust']);
    expect(sql).toMatch(/ILIKE \$2/);
    expect(sql).toMatch(/websearch_to_tsquery\('english', \$3\)/);
  });
});

describe('pagination (deferred item)', () => {
  test('defaults to page 1 / 25 rows via parameterized LIMIT/OFFSET', async () => {
    const result = await applicationQuery.findAllSorted(3, {});

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2 OFFSET \$3/);
    expect(params).toEqual([3, 25, 0]);
    expect(sql).toMatch(/COUNT\(\*\) OVER\(\)::int AS total_count/);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  test('clamps hostile values: pageSize 500→100, page 0→offset 0, junk ignored', async () => {
    await applicationQuery.findAllSorted(3, { page: '0', pageSize: '500' });
    expect(pool.query.mock.calls[0][1].slice(1)).toEqual([100, 0]);

    await applicationQuery.findAllSorted(3, { page: 'abc', pageSize: 'xyz' });
    expect(pool.query.mock.calls[1][1].slice(1)).toEqual([25, 0]);

    await applicationQuery.findAllSorted(3, { page: '4', pageSize: '10' });
    expect(pool.query.mock.calls[2][1].slice(1)).toEqual([10, 30]);
  });

  test('total comes from the window function, not a second query', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 9, total_count: 57 }, { id: 8, total_count: 57 }],
    });

    const result = await applicationQuery.findAllSorted(3, { page: '2', pageSize: '2' });

    expect(pool.query).toHaveBeenCalledTimes(1); // single-pass count
    expect(result.total).toBe(57);
    expect(result.rows).toHaveLength(2);
  });
});
