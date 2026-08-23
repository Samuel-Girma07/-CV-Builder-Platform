describe('sendResetEmail', () => {
  test('never logs the temporary password when Resend API key is not configured', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    jest.resetModules();
    const { logger } = require('../middlewares/logger');
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    const { sendResetEmail: freshSend } = require('../utils/email');

    const wasSent = await freshSend('test@example.com', 'tempPass123');

    expect(wasSent).toBe(false);

    const loggedMessages = [...infoSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .map(call => call[0])
      .join('\n');

    expect(loggedMessages).toContain('test@example.com');
    expect(loggedMessages).toContain('NOT configured');
    expect(loggedMessages).not.toContain('tempPass123');

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();

    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });
});

describe('sendTempPasswordEmail', () => {
  test('never logs the plaintext temporary password when Resend is not configured', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    jest.resetModules();
    const { logger } = require('../middlewares/logger');
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    const { sendTempPasswordEmail: freshSend } = require('../utils/email');

    const wasSent = await freshSend('test@example.com', 'Sup3rSecretTemp');

    expect(wasSent).toBe(false);

    const loggedMessages = [...infoSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .map(call => call[0])
      .join('\n');

    expect(loggedMessages).toContain('test@example.com');
    expect(loggedMessages).toContain('NOT configured');
    expect(loggedMessages).not.toContain('Sup3rSecretTemp');

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();

    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });

  test('sends the plaintext credential in the email body when configured', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 're_test_key';

    jest.resetModules();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null });

    jest.mock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
    }));
    jest.mock('../middlewares/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      requestLogger: jest.fn(),
    }));

    const { sendTempPasswordEmail } = require('../utils/email');
    const result = await sendTempPasswordEmail('user@example.com', 'TempPass99');

    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.to).toBe('user@example.com');
    expect(payload.text).toContain('TempPass99');
    expect(payload.html).toContain('TempPass99');

    if (originalKey) process.env.RESEND_API_KEY = originalKey; else delete process.env.RESEND_API_KEY;
  });

  test('escalates to ERROR-level logging when unconfigured in production', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    const originalEnv = process.env.NODE_ENV;
    delete process.env.RESEND_API_KEY;
    process.env.NODE_ENV = 'production';

    jest.resetModules();
    const { logger } = require('../middlewares/logger');
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    const { sendTempPasswordEmail: freshSend } = require('../utils/email');
    const wasSent = await freshSend('prod-user@example.com', 'ProdTemp55');

    expect(wasSent).toBe(false);
    const errorMessages = errorSpy.mock.calls.map((call) => call[0]).join('\n');
    expect(errorMessages).toContain('NOT configured');
    expect(errorMessages).toContain('prod-user@example.com');
    // The escalation must be ERROR, not the dev-mode WARN.
    expect(warnSpy.mock.calls.map((c) => c[0]).join('\n')).not.toContain('NOT configured');

    warnSpy.mockRestore();
    errorSpy.mockRestore();

    if (originalKey) process.env.RESEND_API_KEY = originalKey; else delete process.env.RESEND_API_KEY;
    if (originalEnv !== undefined) process.env.NODE_ENV = originalEnv; else delete process.env.NODE_ENV;
  });
});
