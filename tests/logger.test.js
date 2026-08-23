describe('requestLogger', () => {
  test('logs the path only, never query strings carrying tickets', () => {
    jest.resetModules();
    let capturedLine = '';
    jest.doMock('fs', () => ({
      existsSync: () => true,
      mkdirSync: jest.fn(),
      appendFile: (file, data, cb) => {
        capturedLine = data;
        cb(null);
      },
    }));

    const { requestLogger } = require('../middlewares/logger');

    let finishHandler;
    const req = {
      method: 'GET',
      baseUrl: '/api/xray',
      path: '/12/pdf',
      originalUrl: '/api/xray/12/pdf?ticket=SUPERSECRET',
    };
    const res = {
      statusCode: 200,
      on(event, fn) { if (event === 'finish') finishHandler = fn; },
    };

    requestLogger(req, res, () => {});
    finishHandler();

    expect(capturedLine).toContain('/api/xray/12/pdf 200');
    expect(capturedLine).not.toContain('SUPERSECRET');
    expect(capturedLine).not.toContain('?');
  });
});
