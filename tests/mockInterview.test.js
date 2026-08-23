process.env.JWT_SECRET = 'test-secret';
process.env.NVIDIA_API_KEY = 'test-key';
globalThis.__aiCreate = jest.fn();

jest.mock('openai', () => {
  return class FakeOpenAI {
    constructor() {
      this.chat = { completions: { create: globalThis.__aiCreate } };
    }
  };
});

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  withTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
}));
jest.mock('../models/mockInterviewQuery', () => ({
  MODES: ['behavioral', 'technical', 'mixed'],
  createSession: jest.fn(),
  getSession: jest.fn(),
  findActiveByApplication: jest.fn(),
  listByApplication: jest.fn(),
  addMessage: jest.fn(),
  getMessages: jest.fn(),
  countCandidateAnswers: jest.fn(),
  completeSession: jest.fn(),
}));
jest.mock('../models/applicationQuery', () => ({
  STATUS_VALUES: ['Applied'],
  findById: jest.fn(),
  updateInterviewPrepForUser: jest.fn(),
}));
jest.mock('../models/profileQuery', () => ({ findByUserId: jest.fn() }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const { normalizeMockTurn } = require('../utils/schemas');
const mockInterviewController = require('../controllers/mockInterviewController');
const pool = require('../config/db');
const mockInterviewQuery = require('../models/mockInterviewQuery');
const applicationQuery = require('../models/applicationQuery');

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

describe('normalizeMockTurn (coach output validator)', () => {
  const GOOD = {
    critique: { rating: 82, strengths: ['specific'], improvements: ['add result'], sampleAnswer: 'x' },
    nextQuestion: 'Tell me about a conflict.',
    finish: false,
  };

  test('accepts a well-formed turn and clamps the rating', () => {
    const out = normalizeMockTurn({ ...GOOD, critique: { ...GOOD.critique, rating: 140 } });
    expect(out).not.toBeNull();
    expect(out.critique.rating).toBe(100);
    expect(out.nextQuestion).toBe('Tell me about a conflict.');
  });

  test('rejects turns without a numeric rating', () => {
    expect(normalizeMockTurn({
      critique: { strengths: [] },
      nextQuestion: 'q',
    })).toBeNull();
  });

  test('a live turn must either advance or finish — otherwise it strands the user', () => {
    expect(normalizeMockTurn({
      critique: { rating: 50 },
      finish: false,
    })).toBeNull();
  });

  test('finish clears any stray nextQuestion', () => {
    const out = normalizeMockTurn({ ...GOOD, finish: true });
    expect(out.finish).toBe(true);
    expect(out.nextQuestion).toBe('');
  });

  test('non-object payloads are rejected outright', () => {
    expect(normalizeMockTurn(null)).toBeNull();
    expect(normalizeMockTurn([GOOD])).toBeNull();
    expect(normalizeMockTurn('rating: 10')).toBeNull();
  });
});

describe('mock interview controller', () => {
  const APP = {
    id: 11,
    user_id: 3,
    job_title: 'Dev',
    company: 'Acme',
    job_description: 'Build.',
    interview_prep_guide: [
      { question: 'Q1?', type: 'Behavioral', suggested_answer: 'a1' },
      { question: 'Q2?', type: 'Technical', suggested_answer: 'a2' },
    ],
  };

  test('start persists the session plus its opening coach question atomically', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    mockInterviewQuery.findActiveByApplication.mockResolvedValue(null);
    mockInterviewQuery.createSession.mockResolvedValue({ id: 5, status: 'active', mode: 'mixed', question_count: 2 });
    mockInterviewQuery.getMessages.mockResolvedValue([{ role: 'coach', content: 'Q1?' }]);
    mockInterviewQuery.addMessage.mockResolvedValue({ id: 100 });

    const res = mkRes();
    await mockInterviewController.start({ params: { appId: '11' }, user: USER, body: {} }, res, jest.fn());

    expect(res._.code).toBe(201);
    expect(res._.body.resumed).toBe(false);
    expect(mockInterviewQuery.createSession).toHaveBeenCalledWith(expect.anything(), 3, 11, 'mixed', 2);
    expect(mockInterviewQuery.addMessage).toHaveBeenCalledWith(
      expect.anything(), 5, 'coach', 'Q1?', { questionIndex: 0 }
    );
  });

  test('start resumes an already-active session instead of stacking a new one', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    mockInterviewQuery.findActiveByApplication.mockResolvedValue({ id: 5, status: 'active' });
    mockInterviewQuery.getMessages.mockResolvedValue([]);

    const res = mkRes();
    await mockInterviewController.start({ params: { appId: '11' }, user: USER, body: {} }, res, jest.fn());

    expect(res._.body.resumed).toBe(true);
    expect(mockInterviewQuery.createSession).not.toHaveBeenCalled();
  });

  test('answering the final question completes the session with the coach rating', async () => {
    mockInterviewQuery.getSession.mockResolvedValue({ id: 5, status: 'active', question_count: 1, application_id: 11 });
    applicationQuery.findById.mockResolvedValue(APP);
    profileQuery = require('../models/profileQuery');
    profileQuery.findByUserId.mockResolvedValue(null);
    mockInterviewQuery.countCandidateAnswers.mockResolvedValue(0);
    globalThis.__aiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        critique: { rating: 76, strengths: ['STAR structure'], improvements: ['quantify'], sampleAnswer: 'better' },
        nextQuestion: '',
        finish: true,
        summary: 'Strong close',
      }) } }],
    });

    const res = mkRes();
    await mockInterviewController.answer(
      { params: { sessionId: '5' }, user: USER, body: { text: 'My answer…' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(200);
    expect(res._.body.finished).toBe(true);
    expect(mockInterviewQuery.addMessage).toHaveBeenCalledTimes(2); // candidate + closing coach line
    expect(mockInterviewQuery.completeSession).toHaveBeenCalledWith(
      expect.anything(), 5, 76, 'Strong close'
    );
    // Critique rides on the candidate message, never the coach line.
    const calls = mockInterviewQuery.addMessage.mock.calls;
    expect(calls[0][2]).toBe('candidate');
    expect(calls[0][4]).toEqual({ questionIndex: 0, critique: expect.objectContaining({ rating: 76 }) });
    expect(calls[1][2]).toBe('coach');
    expect(calls[1][4].critique).toBeNull();
  });

  test('an unreadable coach reply fails loudly before anything is persisted', async () => {
    mockInterviewQuery.getSession.mockResolvedValue({ id: 5, status: 'active', question_count: 2, application_id: 11 });
    applicationQuery.findById.mockResolvedValue(APP);
    require('../models/profileQuery').findByUserId.mockResolvedValue(null);
    mockInterviewQuery.countCandidateAnswers.mockResolvedValue(0);
    globalThis.__aiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"critique":{"strengths":[]},"nextQuestion":""}' } }], // no rating, no finish
    });

    const res = mkRes();
    const next = jest.fn();
    await mockInterviewController.answer(
      { params: { sessionId: '5' }, user: USER, body: { text: 'answer' } },
      res,
      next
    );

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].status).toBe(502);
    expect(mockInterviewQuery.addMessage).not.toHaveBeenCalled();
  });

  test('finished sessions refuse further answers with a clear 409', async () => {
    mockInterviewQuery.getSession.mockResolvedValue({ id: 5, status: 'completed', question_count: 2 });
    const res = mkRes();

    await mockInterviewController.answer(
      { params: { sessionId: '5' }, user: USER, body: { text: 'again' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(409);
    expect(globalThis.__aiCreate).not.toHaveBeenCalled();
  });

  test('someone else\u2019s session is a clean 404', async () => {
    mockInterviewQuery.getSession.mockResolvedValue(null);
    const res = mkRes();

    await mockInterviewController.answer(
      { params: { sessionId: '77' }, user: USER, body: { text: 'hi' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(404);
    expect(pool.withTransaction).not.toHaveBeenCalled();
  });
});
