const { sendResetEmail } = require('../utils/email');

describe('sendResetEmail', () => {
  let logSpy;

  beforeEach(() => {
    // Spy on logger info calls
    const { logger } = require('../middlewares/logger');
    logSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('falls back gracefully to logging to terminal console when SMTP is not configured', async () => {
    // Ensure transporter is null / SMTP not set in test environment
    const wasSent = await sendResetEmail('test@example.com', 'tempPass123');
    
    // It should return false indicating it did not send via SMTP
    expect(wasSent).toBe(false);
    
    // It should log the email address and token link to the console
    const loggedMessages = logSpy.mock.calls.map(call => call[0]).join('\n');
    expect(loggedMessages).toContain('To: test@example.com');
    expect(loggedMessages).toContain('Temporary Password: tempPass123');
  });
});
