process.env.NVIDIA_API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';

/* The fake create() dispatches on params.stream: streaming calls pull from
   globalThis.__streamFactory(), plain calls use __aiCreate. */
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

jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const { callAiStream } = require('../services/aiClient');

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

function failingStreamAfter(chunks, error) {
  let i = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          if (i < chunks.length) {
            return { value: { choices: [{ delta: { content: chunks[i++] } }] }, done: false };
          }
          throw error;
        },
      };
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('callAiStream', () => {
  test('streams primary deltas in order and returns the full text', async () => {
    globalThis.__streamFactory.mockReturnValue(fakeStream(['Hello', ' world', '!']));

    const deltas = [];
    const full = await callAiStream({ messages: [] }, { onDelta: (d) => deltas.push(d) });

    expect(deltas).toEqual(['Hello', ' world', '!']);
    expect(full).toBe('Hello world!');
  });

  test('primary failing before any output falls back without emitting reset', async () => {
    globalThis.__streamFactory
      .mockImplementationOnce(() => Promise.reject(new Error('503 upstream')))
      .mockImplementationOnce(() => fakeStream(['Fallback text']));

    const onReset = jest.fn();
    const deltas = [];
    const full = await callAiStream(
      { messages: [] },
      { onDelta: (d) => deltas.push(d), onReset }
    );

    expect(onReset).not.toHaveBeenCalled();
    expect(full).toBe('Fallback text');
    expect(deltas).toEqual(['Fallback text']);
  });

  test('partial primary output triggers reset before the clean fallback restart', async () => {
    globalThis.__streamFactory
      .mockImplementationOnce(() => failingStreamAfter(['TOTALLY WRONG DRAFT'], new Error('connection reset')))
      .mockImplementationOnce(() => fakeStream(['Dear Hiring Manager,']));

    const onReset = jest.fn();
    const deltas = [];
    const full = await callAiStream(
      { messages: [] },
      { onDelta: (d) => deltas.push(d), onReset }
    );

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(full).toBe('Dear Hiring Manager,');
    // Client must never see the aborted attempt mixed with the good one.
    expect(full).not.toContain('TOTALLY WRONG DRAFT');
  });

  test('an empty stream counts as failure and falls back', async () => {
    globalThis.__streamFactory
      .mockImplementationOnce(() => fakeStream([]))
      .mockImplementationOnce(() => fakeStream(['real content']));

    await expect(callAiStream({ messages: [] })).resolves.toBe('real content');
  });

  test('external abort stops the stream and surfaces as unavailable after fallback window collapses', async () => {
    const controller = new AbortController();
    globalThis.__streamFactory.mockImplementation(() => failingStreamAfter(
      ['partial'],
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    ));

    // Both attempts fail instantly; deadline math stays internal — we only
    // assert the caller gets the friendly terminal error.
    await expect(
      callAiStream({ messages: [] }, { signal: controller.signal })
    ).rejects.toThrow(/unavailable/i);
  });
});
