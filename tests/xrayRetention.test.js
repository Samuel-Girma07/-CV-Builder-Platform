process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn(), on: jest.fn() }));
jest.mock('../utils/atsXray', () => ({ analyzePdfBuffer: jest.fn() }));
jest.mock('../config/upload', () => ({
  isPdfBuffer: jest.fn(() => true),
  createCvUpload: jest.fn(() => ({ single: jest.fn(() => (req, res, next) => next()) })),
  MAX_CV_SIZE_BYTES: 5 * 1024 * 1024,
}));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const pool = require('../config/db');
const xrayController = require('../controllers/xrayController');
const { analyzePdfBuffer } = require('../utils/atsXray');

function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

const USER = { id: 3, email: 'u@x.co' };

beforeEach(() => {
  jest.clearAllMocks();
  // Drop any unconsumed mockResolvedValueOnce queue from a prior test.
  pool.query.mockReset();
});

describe('xray retention (P3-12)', () => {
  test('upload prunes versions beyond the newest 20 for the owning user', async () => {
    analyzePdfBuffer.mockResolvedValue({ isCv: true, risks: [], stream: [], missing: [] });
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // INSERT ... RETURNING id
      .mockResolvedValueOnce({ rows: [] });          // retention DELETE

    const res = mkRes();
    await xrayController.uploadXray(
      { file: { buffer: Buffer.from('%PDF-fake'), originalname: 'cv.pdf' }, user: USER },
      res,
      jest.fn()
    );

    expect(pool.query).toHaveBeenCalledTimes(2);
    const pruneCall = pool.query.mock.calls[1];
    expect(pruneCall[0]).toMatch(/DELETE FROM cv_versions/);
    expect(pruneCall[0]).toMatch(/LIMIT \$2/);
    expect(pruneCall[1]).toEqual([3, 20]);
    expect(res._.body.id).toBe(99);
  });

  test('delete is owner-scoped and 404s on someone else\u2019s version', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // no row for this user
    const res = mkRes();

    await xrayController.deleteVersion({ params: { id: '77' }, user: USER }, res, jest.fn());

    expect(res._.code).toBe(404);
    expect(pool.query.mock.calls[0][1]).toEqual([77, 3]);
  });

  test('delete returns success with the removed id when owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 77 }] });
    const res = mkRes();

    await xrayController.deleteVersion({ params: { id: '77' }, user: USER }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.id).toBe(77);
  });

  test('rejects non-numeric ids before touching the database', async () => {
    const res = mkRes();
    await xrayController.deleteVersion({ params: { id: 'abc' }, user: USER }, res, jest.fn());
    expect(res._.code).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
