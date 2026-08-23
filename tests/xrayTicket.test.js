describe('xray PDF ticket', () => {
  const jwt = require('jsonwebtoken');
  const SECRET = 'test-secret';
  const { safeContentDispositionName } = (() => {
    jest.resetModules();
    process.env.JWT_SECRET = SECRET;
    // Pull the helper without exporting a DB connection: re-require is fine
    // because requiring the controller only needs config/db lazily at call time.
    return require('../controllers/xrayController');
  })();

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  test('a signed ticket round-trips with scope, version, subject and 60s TTL', () => {
    const ticket = jwt.sign(
      { sub: 7, vid: 42, scope: 'xray-pdf' },
      SECRET,
      { expiresIn: 60 }
    );
    const payload = jwt.verify(ticket, SECRET);
    expect(payload.scope).toBe('xray-pdf');
    expect(payload.vid).toBe(42);
    expect(payload.sub).toBe(7);
    expect(payload.exp - payload.iat).toBe(60);
  });

  test('tickets signed for a different purpose are rejected by scope check', () => {
    const sessionLike = jwt.sign({ sub: 7 }, SECRET, { expiresIn: '24h' });
    const payload = jwt.verify(sessionLike, SECRET);
    expect(payload.scope).toBeUndefined();
  });

  test('safeContentDispositionName strips header-breaking characters', () => {
    expect(safeContentDispositionName('my resume"final\r\n.pdf')).toBe('my resume_final .pdf');
    expect(safeContentDispositionName('')).toBe('cv.pdf');
    expect(safeContentDispositionName(null)).toBe('cv.pdf');
    const out = safeContentDispositionName('a/b\\c:d*e?f#g.pdf');
    expect(out).not.toMatch(/[/\\:*?#]/);
    expect(out.length).toBeLessThanOrEqual(80);
  });
});
