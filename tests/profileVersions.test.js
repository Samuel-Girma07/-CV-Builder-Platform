process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  withTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
}));
jest.mock('../models/profileQuery', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn(),
}));
jest.mock('../models/profileVersionQuery', () => ({
  MAX_PROFILE_VERSIONS: 50,
  TRIGGERS: ['manual_save', 'ai_parse', 'ai_summary', 'restore'],
  createSnapshot: jest.fn(),
  prune: jest.fn(),
  listByUser: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('pdf-parse', () => jest.fn());
jest.mock('../services/aiClient', () => ({ callAi: jest.fn() }));
jest.mock('../services/cvPdf', () => ({ streamCvPdf: jest.fn(), TEMPLATES: { modern: {} } }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const profileController = require('../controllers/profileController');
const profileQuery = require('../models/profileQuery');
const profileVersionQuery = require('../models/profileVersionQuery');

function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

const USER = { id: 3, email: 'u@x.co', full_name: 'U' };
const SNAPSHOT_DATA = { personalInfo: { fullName: 'U' }, skills: ['Go'], experience: [] };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profile version endpoints', () => {
  test('saveProfile snapshots the saved state as a manual_save inside one transaction', async () => {
    profileQuery.upsert.mockResolvedValue({ parsed_json_data: SNAPSHOT_DATA });
    profileQuery.findByUserId.mockResolvedValue({ parsed_json_data: SNAPSHOT_DATA });
    const res = mkRes();

    await profileController.saveProfile(
      { user: USER, body: { skills: ['Go'] } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(200);
    expect(profileVersionQuery.createSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      3,
      SNAPSHOT_DATA,
      'manual_save'
    );
    expect(profileVersionQuery.prune).toHaveBeenCalledWith(expect.anything(), 3);
  });

  test('restore writes the snapshot data and records a restore marker', async () => {
    profileVersionQuery.findById.mockResolvedValue({
      id: 12,
      trigger: 'ai_parse',
      parsed_json_data: SNAPSHOT_DATA,
    });
    const res = mkRes();

    await profileController.restoreVersion(
      { params: { versionId: '12' }, user: USER },
      res,
      jest.fn()
    );

    expect(profileQuery.upsert).toHaveBeenCalledWith(3, SNAPSHOT_DATA, expect.anything());
    expect(profileVersionQuery.createSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      3,
      SNAPSHOT_DATA,
      'restore',
      12
    );
    expect(res._.body.profile).toEqual(SNAPSHOT_DATA);
  });

  test('restoring someone else\u2019s version is a clean 404', async () => {
    profileVersionQuery.findById.mockResolvedValue(null);
    const res = mkRes();

    await profileController.restoreVersion(
      { params: { versionId: '99' }, user: USER },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(404);
    expect(profileQuery.upsert).not.toHaveBeenCalled();
    expect(profileVersionQuery.createSnapshot).not.toHaveBeenCalled();
  });

  test('malicious or malformed version ids never reach the database', async () => {
    const res = mkRes();

    await profileController.restoreVersion({ params: { versionId: 'abc' }, user: USER }, res, jest.fn());

    expect(res._.code).toBe(400);
    expect(profileVersionQuery.findById).not.toHaveBeenCalled();
  });
});
