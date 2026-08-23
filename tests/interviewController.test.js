jest.mock('../models/interviewQuery', () => ({
  create: jest.fn(),
  findByApplicationId: jest.fn(),
  findById: jest.fn(),
  checkConflict: jest.fn(),
}));
jest.mock('../models/applicationQuery', () => ({
  findById: jest.fn(),
}));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const interviewController = require('../controllers/interviewController');
const interviewQuery = require('../models/interviewQuery');
const applicationQuery = require('../models/applicationQuery');

function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    setHeader() {},
    send(body) { captured.body = body; return this; },
    _: captured,
  };
}

const USER = { id: 3, email: 'u@x.co', full_name: 'U' };
const APP = { id: 11, user_id: 3 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('create interview input validation (P3-8)', () => {
  test('rejects a title longer than the database column with a clean 400', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    const res = mkRes();

    await interviewController.create(
      { params: { appId: '11' }, user: USER, body: { title: 'x'.repeat(300), startTime: '2026-09-01T10:00:00Z', endTime: '2026-09-01T11:00:00Z' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(interviewQuery.create).not.toHaveBeenCalled();
  });

  test('rejects a location longer than 255 characters with a clean 400', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    const res = mkRes();

    await interviewController.create(
      { params: { appId: '11' }, user: USER, body: { title: 'Screen', location: 'y'.repeat(300), startTime: '2026-09-01T10:00:00Z', endTime: '2026-09-01T11:00:00Z' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(interviewQuery.create).not.toHaveBeenCalled();
  });

  test('rejects non-date strings before they become Invalid Date rows', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    const res = mkRes();

    await interviewController.create(
      { params: { appId: '11' }, user: USER, body: { title: 'Screen', startTime: 'not-a-date', endTime: 'also-not' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(interviewQuery.create).not.toHaveBeenCalled();
  });
});

describe('ICS export escaping (P3-8)', () => {
  test('escapes backslashes, semicolons, commas and newlines per RFC 5545', () => {
    expect(interviewController.icsEscape('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
  });

  test('the generated event body escapes every user-controlled field', async () => {
    interviewQuery.findById.mockResolvedValue({
      id: 9,
      title: 'Tech; Screen, Round 2',
      start_time: new Date('2026-09-01T10:00:00Z'),
      end_time: new Date('2026-09-01T11:00:00Z'),
      created_at: new Date('2026-08-20T10:00:00Z'),
      location: 'HQ, Room 5\nBuilding B',
      notes: 'Line1\r\nLine2',
    });

    const res = mkRes();
    await interviewController.getIcs({ params: { id: '9' }, user: USER }, res, jest.fn());

    const body = res._.body;
    expect(body).toContain('SUMMARY:Tech\\; Screen\\, Round 2');
    expect(body).toContain('LOCATION:HQ\\, Room 5\\nBuilding B');
    expect(body).toContain('DESCRIPTION:Line1\\nLine2');
    // Structure stays intact: exactly one BEGIN/END VEVENT pair.
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(body.match(/END:VEVENT/g)).toHaveLength(1);
  });
});
