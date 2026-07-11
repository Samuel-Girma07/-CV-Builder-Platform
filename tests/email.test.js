describe('sendResetEmail', () => {
  test('falls back gracefully to logging to terminal console when Resend API key is not configured', async () => {
    // Ensure RESEND_API_KEY is not set in test environment
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    // Re-require module after clearing env and resetting modules
    jest.resetModules();
    const { logger } = require('../middlewares/logger');
    const logSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    const { sendResetEmail: freshSend } = require('../utils/email');

    const wasSent = await freshSend('test@example.com', 'tempPass123');

    // It should return false indicating it did not send via API
    expect(wasSent).toBe(false);

    // It should log the email address and temp password to the console
    const loggedMessages = logSpy.mock.calls.map(call => call[0]).join('\n');
    expect(loggedMessages).toContain('To: test@example.com');
    expect(loggedMessages).toContain('Temporary Password: tempPass123');

    logSpy.mockRestore();

    // Restore env
    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });
});
