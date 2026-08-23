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

describe('log rotation', () => {
  test('rotates app.log to app.log.1 when it exceeds the size cap', () => {
    jest.resetModules();
    const renameSpy = jest.fn();
    jest.doMock('fs', () => ({
      existsSync: () => true,
      mkdirSync: jest.fn(),
      statSync: () => ({ size: 6 * 1024 * 1024 }), // over the 5MB cap
      renameSync: renameSpy,
      appendFile: (file, data, cb) => cb(null),
    }));

    const { logger } = require('../middlewares/logger');
    logger.info('rotation trigger line');

    expect(renameSpy).toHaveBeenCalledTimes(1);
    const [from, to] = renameSpy.mock.calls[0];
    expect(from).toMatch(/app\.log$/);
    expect(to).toMatch(/app\.log\.1$/);
  });

  test('does not rotate a file under the cap', () => {
    jest.resetModules();
    const renameSpy = jest.fn();
    jest.doMock('fs', () => ({
      existsSync: () => true,
      mkdirSync: jest.fn(),
      statSync: () => ({ size: 1024 }),
      renameSync: renameSpy,
      appendFile: (file, data, cb) => cb(null),
    }));

    const { logger } = require('../middlewares/logger');
    logger.info('small log line');

    expect(renameSpy).not.toHaveBeenCalled();
  });

  test('a missing log file is tolerated without rotating', () => {
    jest.resetModules();
    const renameSpy = jest.fn();
    jest.doMock('fs', () => ({
      existsSync: () => false,
      mkdirSync: jest.fn(),
      statSync: () => { throw new Error('ENOENT'); },
      renameSync: renameSpy,
      appendFile: (file, data, cb) => cb(null),
    }));

    const { logger } = require('../middlewares/logger');
    expect(() => logger.info('first ever line')).not.toThrow();
    expect(renameSpy).not.toHaveBeenCalled();
  });
});
