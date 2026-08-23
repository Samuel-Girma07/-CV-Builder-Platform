jest.mock('../models/insightQuery', () => ({
  getSkillGaps: jest.fn(),
  getOutcomeSplit: jest.fn(),
}));

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

describe('outcome insights', () => {
  test('computes interview-reach rates and uplift for both groups', async () => {
    insightQuery.getOutcomeSplit.mockResolvedValue({
      total: 20,
      tailoredTotal: 10, tailoredInterviewed: 6,
      plainTotal: 10, plainInterviewed: 2,
      letterTotal: 8, letterInterviewed: 4,
      noLetterTotal: 12, noLetterInterviewed: 4,
    });
    const res = mkRes();

    await insightController.getOutcomes({ user: { id: 3 } }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.total).toBe(20);
    const [tailored, letter] = res._.body.insights;
    expect(tailored.sampleOk).toBe(true);
    expect(tailored.withRate).toBe(60);
    expect(tailored.withoutRate).toBe(20);
    expect(tailored.uplift).toBe(3);
    expect(letter.withRate).toBe(50);
    expect(letter.uplift).toBe(1.5);
  });

  test('refuses to publish uplift when either group is below the sample floor', async () => {
    insightQuery.getOutcomeSplit.mockResolvedValue({
      total: 6,
      tailoredTotal: 5, tailoredInterviewed: 5,
      plainTotal: 1, plainInterviewed: 0,
      letterTotal: 3, letterInterviewed: 0,
      noLetterTotal: 3, noLetterInterviewed: 0,
    });
    const res = mkRes();

    await insightController.getOutcomes({ user: { id: 3 } }, res, jest.fn());

    const [tailored, letter] = res._.body.insights;
    expect(tailored.sampleOk).toBe(false);
    expect(tailored.uplift).toBeUndefined();
    // Both groups have exactly 3 rows — at the floor boundary it is honest.
    expect(letter.sampleOk).toBe(true);
    expect(letter.uplift).toBe(0);
  });

  test('a zero baseline with real hits reports "new effect" (null) rather than Infinity', async () => {
    insightQuery.getOutcomeSplit.mockResolvedValue({
      total: 8,
      tailoredTotal: 4, tailoredInterviewed: 2,
      plainTotal: 4, plainInterviewed: 0,
      letterTotal: 4, letterInterviewed: 2,
      noLetterTotal: 4, noLetterInterviewed: 1,
    });
    const res = mkRes();

    await insightController.getOutcomes({ user: { id: 3 } }, res, jest.fn());

    expect(res._.body.insights[0].uplift).toBeNull();
    expect(res._.body.insights[1].uplift).toBe(2);
  });

  test('getOutcomeSplit failures propagate through the error handler', async () => {
    insightQuery.getOutcomeSplit.mockRejectedValue(new Error('boom'));
    const res = mkRes();
    const next = jest.fn();

    await insightController.getOutcomes({ user: { id: 3 } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].message).toBe('boom');
  });
});
