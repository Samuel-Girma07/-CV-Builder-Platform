jest.mock('../models/insightQuery', () => ({ getSkillGaps: jest.fn() }));

const insightController = require('../controllers/insightController');
const insightQuery = require('../models/insightQuery');

function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('insights controller', () => {
  test('reports sampleOk=true once the aggregate volume clears the noise floor', async () => {
    insightQuery.getSkillGaps.mockResolvedValue([
      { skill: 'react', total: 4, recentCount: 2, priorCount: 2, trend: 'steady' },
    ]);
    const res = mkRes();

    await insightController.getSkillGaps({ user: { id: 3 } }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.sampleOk).toBe(true);
    expect(res._.body.gaps[0].skill).toBe('react');
  });

  test('flags sampleOk=false when there is too little signal to rank honestly', async () => {
    insightQuery.getSkillGaps.mockResolvedValue([
      { skill: 'docker', total: 1, recentCount: 1, priorCount: 0, trend: 'rising' },
    ]);
    const res = mkRes();

    await insightController.getSkillGaps({ user: { id: 3 } }, res, jest.fn());

    expect(res._.body.sampleOk).toBe(false);
  });

  test('database failures reach the error handler instead of leaking details', async () => {
    insightQuery.getSkillGaps.mockRejectedValue(new Error('connection reset'));
    const res = mkRes();
    const next = jest.fn();

    await insightController.getSkillGaps({ user: { id: 3 } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].message).toBe('connection reset');
    expect(res._.body).toBeUndefined();
  });
});
