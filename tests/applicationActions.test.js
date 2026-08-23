process.env.NVIDIA_API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
globalThis.__aiCreate = jest.fn();

jest.mock('openai', () => {
  return class FakeOpenAI {
    constructor() {
      this.chat = { completions: { create: globalThis.__aiCreate } };
    }
  };
});

jest.mock('../models/applicationQuery', () => ({
  STATUS_VALUES: ['Applied', 'Interviewing', 'Offered/Hired', 'Rejected'],
  create: jest.fn(),
  updateAtsScore: jest.fn(),
  updatePartial: jest.fn(),
  bulkUpdateStatus: jest.fn(),
  bulkDelete: jest.fn(),
  bulkRestore: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
  findAllSorted: jest.fn(),
}));
jest.mock('../models/profileQuery', () => ({ findByUserId: jest.fn(), upsert: jest.fn() }));
jest.mock('../models/userTablePreferenceQuery', () => ({ get: jest.fn(), upsert: jest.fn() }));
jest.mock('../services/coverLetterPdf', () => ({ streamCoverLetterPdf: jest.fn() }));
jest.mock('../services/cvPdf', () => ({ streamCvPdf: jest.fn(), TEMPLATES: { modern: {} } }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const applicationController = require('../controllers/applicationController');
const applicationQuery = require('../models/applicationQuery');
const profileQuery = require('../models/profileQuery');

function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    headersSent: false,
    _: captured,
  };
}

const USER = { id: 3, email: 'u@x.co', full_name: 'U' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updatePartial status validation (P1-12)', () => {
  test('rejects a non-canonical status with a 400 and never touches the DB', async () => {
    const res = mkRes();
    await applicationController.updatePartial(
      { params: { id: '5' }, user: USER, body: { status: 'banana' } },
      res,
      jest.fn()
    );
    expect(res._.code).toBe(400);
    expect(res._.body.error).toMatch(/Status must be one of/i);
    expect(applicationQuery.updatePartial).not.toHaveBeenCalled();
  });

  test('rejects overlong job_title before it becomes a Postgres 22001 error', async () => {
    const res = mkRes();
    await applicationController.updatePartial(
      { params: { id: '5' }, user: USER, body: { job_title: 'x'.repeat(300) } },
      res,
      jest.fn()
    );
    expect(res._.code).toBe(400);
    expect(applicationQuery.updatePartial).not.toHaveBeenCalled();
  });

  test('passes canonical payloads through to the query layer', async () => {
    applicationQuery.updatePartial.mockResolvedValue({ id: 5, status: 'Interviewing' });
    const res = mkRes();
    await applicationController.updatePartial(
      { params: { id: '5' }, user: USER, body: { status: 'Interviewing' } },
      res,
      jest.fn()
    );
    expect(res._.code).toBe(200);
    expect(applicationQuery.updatePartial).toHaveBeenCalledWith(5, 3, { status: 'Interviewing' });
  });
});

describe('bulkAction operations (P1-8, P1-12)', () => {
  test('restore operation calls bulkRestore with owner-scoped ids', async () => {
    applicationQuery.bulkRestore.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = mkRes();

    await applicationController.bulkAction(
      { user: USER, body: { ids: [1, 2], operation: 'restore' } },
      res,
      jest.fn()
    );

    expect(applicationQuery.bulkRestore).toHaveBeenCalledWith(3, [1, 2]);
    expect(res._.body.restored).toEqual([1, 2]);
  });

  test('status operation rejects invalid values', async () => {
    const res = mkRes();
    await applicationController.bulkAction(
      { user: USER, body: { ids: [1], operation: 'status', payload: { status: 'applied' } } },
      res,
      jest.fn()
    );
    expect(res._.code).toBe(400);
    expect(applicationQuery.bulkUpdateStatus).not.toHaveBeenCalled();
  });

  test('delete operation soft-deletes via bulkDelete', async () => {
    applicationQuery.bulkDelete.mockResolvedValue([{ id: 9 }]);
    const res = mkRes();

    await applicationController.bulkAction(
      { user: USER, body: { ids: [9], operation: 'delete' } },
      res,
      jest.fn()
    );

    expect(applicationQuery.bulkDelete).toHaveBeenCalledWith(3, [9]);
    expect(res._.body.deleted).toEqual([9]);
  });
});

describe('create compensating delete (P1-11)', () => {
  test('removes the row created in this request when AI scoring fails', async () => {
    applicationQuery.create.mockResolvedValue({ id: 77, status: 'Applied' });
    applicationQuery.delete.mockResolvedValue({ id: 77 });
    profileQuery.findByUserId.mockResolvedValue(null);
    globalThis.__aiCreate.mockResolvedValue({
      choices: [{ message: { content: 'not-json-at-all' } }],
    });
    const next = jest.fn();
    const res = mkRes();

    await applicationController.create(
      {
        user: USER,
        body: { jobTitle: 'Dev', company: 'Acme', jobDescription: 'Build things and ship them often.' },
      },
      res,
      next
    );

    expect(applicationQuery.delete).toHaveBeenCalledWith(77, 3);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].status).toBe(502);
  });

  test('does not compensate when scoring succeeds end-to-end', async () => {
    applicationQuery.create.mockResolvedValue({ id: 78, status: 'Applied' });
    profileQuery.findByUserId.mockResolvedValue({ parsed_json_data: { skills: ['Go'] } });
    globalThis.__aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ats_match_score: 88, missing_skills: ['k8s'] }) } }],
    });
    applicationQuery.updateAtsScore.mockResolvedValue({ id: 78, ats_match_score: 88 });
    const next = jest.fn();
    const res = mkRes();

    await applicationController.create(
      {
        user: USER,
        body: { jobTitle: 'Dev', company: 'Acme', jobDescription: 'Build things and ship them often.' },
      },
      res,
      next
    );

    expect(res._.code).toBe(201);
    expect(next).not.toHaveBeenCalled();
    expect(applicationQuery.delete).not.toHaveBeenCalled();
    // Owner-scoped score update (regression guard for the new signature)
    expect(applicationQuery.updateAtsScore).toHaveBeenCalledWith(78, 3, 88, ['k8s']);
  });
});

describe('getList pagination passthrough (deferred item)', () => {
  test('forwards page params and returns the full pagination envelope', async () => {
    applicationQuery.findAllSorted.mockResolvedValue({
      rows: [{ id: 1 }], total: 42, page: 2, pageSize: 10,
    });
    const res = mkRes();

    await applicationController.getList(
      { user: USER, query: { sort: 'created_at', order: 'desc', page: '2', pageSize: '10', q: 'rust' } },
      res,
      jest.fn()
    );

    expect(applicationQuery.findAllSorted).toHaveBeenCalledWith(3, {
      sort: 'created_at', order: 'desc', q: 'rust', page: '2', pageSize: '10', filters: {},
    });
    expect(res._.body).toEqual({
      applications: [{ id: 1 }],
      total: 42,
      page: 2,
      pageSize: 10,
    });
  });

  test('filter_ prefixed params are collected, everything else dropped', async () => {
    applicationQuery.findAllSorted.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 25 });
    const res = mkRes();

    await applicationController.getList(
      { user: USER, query: { filter_status: 'Applied', banana: 'yes' } },
      res,
      jest.fn()
    );

    expect(applicationQuery.findAllSorted).toHaveBeenCalledWith(3, {
      sort: undefined, order: undefined, q: undefined, page: undefined, pageSize: undefined,
      filters: { status: 'Applied' },
    });
  });
});

describe('AI feature error propagation (P1-4)', () => {
  const APP = {
    id: 42,
    user_id: 3,
    job_title: 'Dev',
    company: 'Acme',
    job_description: 'Build things.',
  };

  function unreadableAiResponse() {
    globalThis.__aiCreate.mockResolvedValue({
      choices: [{ message: { content: '```json\nnot-really-json' } }],
    });
  }

  test('tailorCv forwards its deliberate 502 to the error handler instead of masking it as 500', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    profileQuery.findByUserId.mockResolvedValue({ parsed_json_data: { experience: [{}] } });
    applicationQuery.updateTailoredCvForUser = jest.fn();
    unreadableAiResponse();

    const next = jest.fn();
    await applicationController.tailorCv(
      { params: { id: '42' }, user: USER },
      mkRes(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].status).toBe(502);
    expect(next.mock.calls[0][0].message).toMatch(/unreadable CV/i);
  });

  test('generateInterviewPrep forwards its deliberate 502 as well', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    profileQuery.findByUserId.mockResolvedValue(null);
    applicationQuery.updateInterviewPrepForUser = jest.fn();
    unreadableAiResponse();

    const next = jest.fn();
    await applicationController.generateInterviewPrep(
      { params: { id: '42' }, user: USER },
      mkRes(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].status).toBe(502);
  });

  test('tailored CV that fails structural validation reaches the client as a 502', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    profileQuery.findByUserId.mockResolvedValue({ parsed_json_data: { experience: [{}] } });
    applicationQuery.updateTailoredCvForUser = jest.fn();
    // Parses fine as JSON but has no experience array → normalizeTailoredProfile rejects.
    globalThis.__aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ personalInfo: {} } ) } }],
    });

    const next = jest.fn();
    await applicationController.tailorCv(
      { params: { id: '42' }, user: USER },
      mkRes(),
      next
    );

    expect(next.mock.calls[0][0].status).toBe(502);
    expect(applicationQuery.updateTailoredCvForUser).not.toHaveBeenCalled();
  });
});
