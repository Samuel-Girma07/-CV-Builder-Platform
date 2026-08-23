process.env.JWT_SECRET = 'test-secret';
process.env.NVIDIA_API_KEY = 'test-key';

/* Streaming calls pull from __streamFactory; plain calls (none in this suite)
   would use __aiCreate. */
globalThis.__streamFactory = jest.fn();
globalThis.__aiCreate = jest.fn();

jest.mock('openai', () => {
  return class FakeOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: async (params) => {
            if (params.stream) return globalThis.__streamFactory();
            return globalThis.__aiCreate(params);
          },
        },
      };
    }
  };
});

function fakeStream(chunks) {
  let i = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => (i < chunks.length
          ? { value: { choices: [{ delta: { content: chunks[i++] } }] }, done: false }
          : { value: undefined, done: true }),
      };
    },
  };
}

jest.mock('../models/applicationQuery', () => ({
  STATUS_VALUES: ['Applied', 'Interviewing', 'Offered/Hired', 'Rejected'],
  findById: jest.fn(),
  updateCoverLetterForUser: jest.fn(),
}));
jest.mock('../models/profileQuery', () => ({ findByUserId: jest.fn(), upsert: jest.fn() }));
jest.mock('../services/coverLetterPdf', () => ({ streamCoverLetterPdf: jest.fn() }));
jest.mock('../services/cvPdf', () => ({ streamCvPdf: jest.fn(), TEMPLATES: { modern: {} } }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const applicationController = require('../controllers/applicationController');
const applicationQuery = require('../models/applicationQuery');

const SECRET = 'test-secret';
const APP = { id: 21, user_id: 3, job_title: 'Dev', company: 'Acme', job_description: 'Build.' };

function mkSseRes() {
  const frames = [];
  return {
    writeHead(code, headers) { this.statusCode = code; this.headers = headers; },
    flushHeaders() {},
    on() {},
    write(chunk) { frames.push(chunk); return true; },
    end() { this.ended = true; },
    writableEnded: false,
    statusCode: 0,
    headers: null,
    ended: false,
    frames,
  };
}

function sseEvent(frames, name) {
  const frame = frames.find((f) => f.startsWith(`event: ${name}\n`));
  if (!frame) return null;
  return JSON.parse(frame.split('data: ')[1]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cover-letter streaming endpoint', () => {
  test('issues a scoped, short-lived ticket for owned applications', async () => {
    applicationQuery.findById.mockResolvedValue(APP);
    const res = {
      status(code) { this._code = code; return this; },
      json(body) { this._body = body; return this; },
    };

    await applicationController.issueCoverLetterStreamTicket(
      { params: { id: '21' }, user: { id: 3 } },
      res,
      jest.fn()
    );

    expect(res._body.expiresIn).toBe(60);
    const payload = jwt.verify(res._body.ticket, SECRET);
    expect(payload.scope).toBe('cover-letter-stream');
    expect(payload.aid).toBe(21);
    expect(payload.sub).toBe(3);
  });

  test('streams start → deltas → done and persists the finished letter', async () => {
    const ticket = jwt.sign({ sub: 3, aid: 21, scope: 'cover-letter-stream' }, SECRET, { expiresIn: 60 });
    globalThis.__streamFactory.mockReturnValue(fakeStream(['Dear ', 'Hiring Manager,']));
    applicationQuery.findById.mockResolvedValue(APP);
    require('../models/profileQuery').findByUserId.mockResolvedValue({ parsed_json_data: {} });
    applicationQuery.updateCoverLetterForUser.mockResolvedValue({ id: 21 });

    const res = mkSseRes();
    await applicationController.streamCoverLetter(
      { params: { id: '21' }, query: { ticket, tone: 'Formal' }, on: jest.fn() },
      res,
      jest.fn()
    );

    expect(res.headers['Content-Type']).toContain('text/event-stream');
    expect(sseEvent(res.frames, 'start')).toEqual({ tone: 'Formal' });
    expect(applicationQuery.updateCoverLetterForUser).toHaveBeenCalledWith(21, 3, 'Formal', 'Dear Hiring Manager,');
    expect(sseEvent(res.frames, 'done').application.id).toBe(21);
    expect(res.ended).toBe(true);
  });

  test('rejects a ticket minted for a different document with 403 JSON, no SSE', async () => {
    const wrongDocTicket = jwt.sign({ sub: 3, aid: 99, scope: 'cover-letter-stream' }, SECRET, { expiresIn: 60 });
    const res = {
      status(code) { this._code = code; return this; },
      json(body) { this._body = body; return this; },
      writeHead: jest.fn(),
      write: jest.fn(),
    };

    await applicationController.streamCoverLetter(
      { params: { id: '21' }, query: { ticket: wrongDocTicket }, on: jest.fn() },
      res,
      jest.fn()
    );

    expect(res._code).toBe(403);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  test('expired tickets get a friendly 401 before any stream starts', async () => {
    const staleTicket = jwt.sign({ sub: 3, aid: 21, scope: 'cover-letter-stream' }, SECRET, { expiresIn: -10 });
    const res = {
      status(code) { this._code = code; return this; },
      json(body) { this._body = body; return this; },
      writeHead: jest.fn(),
    };

    await applicationController.streamCoverLetter(
      { params: { id: '21' }, query: { ticket: staleTicket }, on: jest.fn() },
      res,
      jest.fn()
    );

    expect(res._code).toBe(401);
    expect(res._body.error).toMatch(/expired/i);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  test('AI failure surfaces as an error frame instead of hanging the connection', async () => {
    const ticket = jwt.sign({ sub: 3, aid: 21, scope: 'cover-letter-stream' }, SECRET, { expiresIn: 60 });
    const unavailable = new Error('The AI service is currently unavailable. Please try again in a moment.');
    globalThis.__streamFactory
      .mockImplementationOnce(() => Promise.reject(unavailable))
      .mockImplementationOnce(() => Promise.reject(unavailable));
    applicationQuery.findById.mockResolvedValue(APP);
    require('../models/profileQuery').findByUserId.mockResolvedValue(null);

    const res = mkSseRes();
    await applicationController.streamCoverLetter(
      { params: { id: '21' }, query: { ticket }, on: jest.fn() },
      res,
      jest.fn()
    );

    const errFrame = sseEvent(res.frames, 'error');
    expect(errFrame.message).toMatch(/unavailable/i);
    expect(res.ended).toBe(true);
    expect(sseEvent(res.frames, 'done')).toBeNull();
  });
});
