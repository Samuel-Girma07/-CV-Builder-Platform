process.env.JWT_SECRET = 'test-secret';

jest.mock('../models/exportQuery', () => ({
  gatherAll: jest.fn(),
}));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const exportController = require('../controllers/exportController');
const exportQuery = require('../models/exportQuery');

function mkRes() {
  const captured = {
    code: 200,
    headers: {},
  };
  return {
    setHeader(k, v) { captured.headers[k] = v; return this; },
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

const USER = { id: 3 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('account data export (D3)', () => {
  test('returns the full bundle as a dated JSON attachment', async () => {
    exportQuery.gatherAll.mockResolvedValue({
      exportedAt: '2026-08-23T00:00:00.000Z',
      user: { id: 3, email: 'u@x.co' },
      applications: [{ id: 1 }],
      contacts: [],
    });

    const res = mkRes();
    await exportController.exportAccount({ user: USER }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.headers['Content-Type']).toBe('application/json');
    expect(res._.headers['Content-Disposition']).toMatch(/^attachment; filename="cv-builder-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res._.body.applications).toEqual([{ id: 1 }]);
  });

  test('a missing user row yields 404 rather than an empty export', async () => {
    exportQuery.gatherAll.mockResolvedValue({ user: null, applications: [] });

    const res = mkRes();
    await exportController.exportAccount({ user: USER }, res, jest.fn());

    expect(res._.code).toBe(404);
    expect(res._.headers['Content-Disposition']).toBeUndefined();
  });

  test('database failures propagate through next()', async () => {
    exportQuery.gatherAll.mockRejectedValue(new Error('timeout'));
    const res = mkRes();
    const next = jest.fn();

    await exportController.exportAccount({ user: USER }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].message).toBe('timeout');
  });
});
