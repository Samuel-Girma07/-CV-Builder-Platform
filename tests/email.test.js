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
