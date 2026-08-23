process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  withTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
}));
jest.mock('../models/logQuery', () => ({
  KINDS: ['note', 'call', 'email', 'interview', 'offer', 'rejection'],
  MAX_CONTENT_LENGTH: 2000,
  validateId: jest.requireActual('../models/logQuery').validateId,
  createContact: jest.fn(),
  listContacts: jest.fn(),
  deleteContact: jest.fn(),
  createActivity: jest.fn(),
  listActivities: jest.fn(),
  deleteActivity: jest.fn(),
}));
jest.mock('../models/applicationQuery', () => ({ findById: jest.fn() }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const logController = require('../controllers/logController');
const applicationQuery = require('../models/applicationQuery');
const pool = require('../config/db');

const logQuery = require('../models/logQuery');
const USER = { id: 3 };

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

describe('contacts & activity log (C4)', () => {
  test('addContact rejects a missing name before touching the database', async () => {
    applicationQuery.findById.mockResolvedValue({ id: 9, user_id: 3 });
    const res = mkRes();

    await logController.addContact(
      { params: { id: '9' }, user: USER, body: { role: 'HR' } },
      res, jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(logQuery.createContact).not.toHaveBeenCalled();
  });

  test('addContact on someone else\u2019s application is a clean 404', async () => {
    applicationQuery.findById.mockResolvedValue(null);
    const res = mkRes();

    await logController.addContact(
      { params: { id: '9' }, user: USER, body: { name: 'Recruiter Rita' } },
      res, jest.fn()
    );

    expect(res._.code).toBe(404);
    expect(logQuery.createContact).not.toHaveBeenCalled();
  });

  test('addActivity rejects kinds outside the canonical set', async () => {
    applicationQuery.findById.mockResolvedValue({ id: 9, user_id: 3 });
    const res = mkRes();

    await logController.addActivity(
      { params: { id: '9' }, user: USER, body: { kind: 'banana' } },
      res, jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(res._.body.error).toMatch(/Kind must be one of/i);
    expect(pool.withTransaction).not.toHaveBeenCalled();
  });

  test('addActivity rejects an invalid occurredAt date', async () => {
    applicationQuery.findById.mockResolvedValue({ id: 9, user_id: 3 });
    const res = mkRes();

    await logController.addActivity(
      { params: { id: '9' }, user: USER, body: { kind: 'call', occurredAt: 'yesterday-ish' } },
      res, jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(logQuery.createActivity).not.toHaveBeenCalled();
  });

  test('deleting a foreign entry is a clean 404 for both types', async () => {
    logQuery.deleteContact.mockResolvedValue(null);
    logQuery.deleteActivity.mockResolvedValue(null);

    const r1 = mkRes();
    await logController.deleteContact({ params: { entryId: '5' }, user: USER }, r1, jest.fn());
    const r2 = mkRes();
    await logController.deleteActivity({ params: { entryId: '5' }, user: USER }, r2, jest.fn());

    expect(r1._.code).toBe(404);
    expect(r2._.code).toBe(404);
  });

  test('lists are scoped by owner + application', async () => {
    logQuery.listContacts.mockResolvedValue([]);
    logQuery.listActivities.mockResolvedValue([]);

    await logController.listContacts(
      { params: { id: '9' }, user: USER }, mkRes(), jest.fn()
    );
    await logController.listActivities(
      { params: { id: '9' }, user: USER }, mkRes(), jest.fn()
    );

    expect(logQuery.listContacts).toHaveBeenCalledWith(3, 9);
    expect(logQuery.listActivities).toHaveBeenCalledWith(3, 9);
  });
});
