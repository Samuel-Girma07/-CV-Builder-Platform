process.env.NVIDIA_API_KEY = 'test-key';
process.env.NVIDIA_MODEL = 'test-primary-model';
globalThis.__aiCreate = jest.fn();

jest.mock('openai', () => {
  return class FakeOpenAI {
    constructor() {
      this.chat = { completions: { create: (...args) => globalThis.__aiCreate(...args) } };
    }
  };
});

jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const { callAi } = require('../services/aiClient');

beforeEach(() => {
  globalThis.__aiCreate.mockReset();
});

describe('callAi (shared AI client)', () => {
  test('uses the primary model when it responds in time', async () => {
    globalThis.__aiCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

    const result = await callAi({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result.choices[0].message.content).toBe('ok');
    expect(globalThis.__aiCreate).toHaveBeenCalledTimes(1);
    expect(globalThis.__aiCreate.mock.calls[0][0].model).toBe('test-primary-model');
  });

  test('retries on the fallback model when the primary errors', async () => {
    globalThis.__aiCreate
      .mockRejectedValueOnce(new Error('primary exploded'))
      .mockResolvedValueOnce({ choices: [{ message: { content: 'fallback-ok' } }] });

    const result = await callAi({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result.choices[0].message.content).toBe('fallback-ok');
    expect(globalThis.__aiCreate).toHaveBeenCalledTimes(2);
    expect(globalThis.__aiCreate.mock.calls[1][0].model).toBe('meta/llama-3.1-8b-instruct');
    // The retry must be abortable within the shared deadline.
    expect(globalThis.__aiCreate.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });

  test('surfaces a single friendly error when every attempt fails', async () => {
    globalThis.__aiCreate.mockRejectedValue(new Error('down'));

    await expect(callAi({ messages: [] })).rejects.toThrow(/AI service is currently unavailable/i);
    expect(globalThis.__aiCreate).toHaveBeenCalledTimes(2);
  });
});
