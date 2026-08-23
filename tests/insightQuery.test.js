jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn(), on: jest.fn() }));

const pool = require('../config/db');
const insightQuery = require('../models/insightQuery');

beforeEach(() => {
  pool.query.mockReset();
});

describe('skill-gap radar query', () => {
  test('scopes to the user, excludes soft-deleted rows, and caps results', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await insightQuery.getSkillGaps(7, 5);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([7, 5]);
    expect(sql).toMatch(/a\.user_id = \$1/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/LIMIT \$2/);
  });

  test('maps snake_case rows to camelCase and derives the trend direction', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { skill: 'kubernetes', total: 9, recent_count: 4, prior_count: 2 }, // rising
        { skill: 'graphql', total: 6, recent_count: 1, prior_count: 3 },    // falling
        { skill: 'rust', total: 3, recent_count: 2, prior_count: 2 },       // steady
      ],
    });

    const gaps = await insightQuery.getSkillGaps(3, 10);

    expect(gaps).toHaveLength(3);
    expect(gaps[0]).toEqual({
      skill: 'kubernetes',
      total: 9,
      recentCount: 4,
      priorCount: 2,
      trend: 'rising',
    });
    expect(gaps[1].trend).toBe('falling');
    expect(gaps[2].trend).toBe('steady');
  });

  test('numeric aggregates arrive as strings from pg and are coerced to numbers', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ skill: 'sql', total: '12', recent_count: '0', prior_count: '0' }],
    });

    const [gap] = await insightQuery.getSkillGaps(1);

    expect(gap.total).toBe(12);
    expect(gap.recentCount).toBe(0);
  });
});

describe('outcome split query', () => {
  test('joins status history once per application with feature flags computed in SQL', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ total: 10 }] });

    const split = await insightQuery.getOutcomeSplit(4);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([4]);
    expect(sql).toMatch(/application_status_history/);
    expect(sql).toMatch(/tailored_cv_profile IS NOT NULL/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(split.total).toBe(10);
  });

  test('an empty result row still yields a fully numeric object', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const split = await insightQuery.getOutcomeSplit(4);

    expect(split).toEqual({
      total: 0,
      tailoredTotal: 0,
      tailoredInterviewed: 0,
      plainTotal: 0,
      plainInterviewed: 0,
      letterTotal: 0,
      letterInterviewed: 0,
      noLetterTotal: 0,
      noLetterInterviewed: 0,
    });
  });
});
