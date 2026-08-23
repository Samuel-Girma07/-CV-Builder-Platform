jest.mock('../models/userQuery', () => ({
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  updateDetails: jest.fn(),
  updatePassword: jest.fn(),
  deleteById: jest.fn(),
  setResetToken: jest.fn(),
  findByResetToken: jest.fn(),
  completePasswordReset: jest.fn(),
}));

jest.mock('../models/profileQuery', () => ({ upsert: jest.fn(), findByUserId: jest.fn() }));
jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn(), on: jest.fn() }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));
jest.mock('../utils/email', () => ({
  sendResetEmail: jest.fn(),
  isEmailConfigured: jest.fn(() => true),
}));

process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const userQuery = require('../models/userQuery');
const { sendResetEmail } = require('../utils/email');

function mkRes() {
  const captured = { code: 200 }; // express res.json() defaults to 200
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('forgotPassword (anti-enumeration)', () => {
  test('unknown email receives the identical neutral 200 response', async () => {
    userQuery.findByEmail.mockResolvedValue(null);
    const res = mkRes();

    await authController.forgotPassword({ body: { email: 'ghost@example.com' } }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.message).toMatch(/reset link has been sent/i);
    expect(userQuery.setResetToken).not.toHaveBeenCalled();
    expect(sendResetEmail).not.toHaveBeenCalled();
  });

  test('known email stores only a hash and returns the same neutral message', async () => {
    userQuery.findByEmail.mockResolvedValue({ id: 5, email: 'a@b.co' });
    userQuery.setResetToken.mockResolvedValue({ id: 5 });
    sendResetEmail.mockResolvedValue(true);
    const res = mkRes();

    await authController.forgotPassword({ body: { email: 'A@B.co' } }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.message).toMatch(/reset link has been sent/i);
    expect(sendResetEmail).toHaveBeenCalledWith('a@b.co', expect.any(String));

    const rawToken = sendResetEmail.mock.calls[0][1];
    const [calledUserId, storedValue] = userQuery.setResetToken.mock.calls[0];
    expect(calledUserId).toBe(5);
    expect(storedValue).toHaveLength(64); // sha256 hex
    expect(storedValue).not.toBe(rawToken); // raw token never persisted
  });

  test('email delivery failure returns 502 without leaking internals', async () => {
    userQuery.findByEmail.mockResolvedValue({ id: 5, email: 'a@b.co' });
    userQuery.setResetToken.mockResolvedValue({ id: 5 });
    sendResetEmail.mockRejectedValue(new Error('smtp down'));
    const res = mkRes();

    await authController.forgotPassword({ body: { email: 'a@b.co' } }, res, jest.fn());

    expect(res._.code).toBe(502);
    expect(res._.body.error).toMatch(/could not send/i);
    expect(JSON.stringify(res._.body)).not.toMatch(/smtp/);
  });
});

describe('resetPassword', () => {
  test('rejects passwords failing policy', async () => {
    const res = mkRes();
    await authController.resetPassword({ body: { token: 't', newPassword: 'weak' } }, res, jest.fn());
    expect(res._.code).toBe(400);
    expect(userQuery.findByResetToken).not.toHaveBeenCalled();
  });

  test('invalid or expired token gets a friendly 400', async () => {
    userQuery.findByResetToken.mockResolvedValue(null);
    const res = mkRes();

    await authController.resetPassword({ body: { token: 'stale', newPassword: 'GoodPass1' } }, res, jest.fn());

    expect(res._.code).toBe(400);
    expect(res._.body.error).toMatch(/invalid or has expired/i);
    expect(userQuery.completePasswordReset).not.toHaveBeenCalled();
  });

  test('valid token completes the reset and issues a session JWT', async () => {
    userQuery.findByResetToken.mockResolvedValue({ id: 9, email: 'x@y.z' });
    userQuery.completePasswordReset.mockResolvedValue({
      id: 9,
      email: 'x@y.z',
      full_name: 'X Y',
      created_at: new Date(),
      must_change_password: false,
      reset_token_expires: null,
    });
    const res = mkRes();

    await authController.resetPassword({ body: { token: 'rawtok', newPassword: 'GoodPass1' } }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(typeof res._.body.token).toBe('string');
    const decoded = jwt.verify(res._.body.token, 'test-secret');
    expect(decoded.sub).toBe(9);

    const [resetId, newHash] = userQuery.completePasswordReset.mock.calls[0];
    expect(resetId).toBe(9);
    expect(newHash).not.toBe('GoodPass1'); // hashed before storage
  });

  test('the token lookup receives a sha-256 hex digest of the raw token', async () => {
    userQuery.findByResetToken.mockResolvedValue(null);
    const res = mkRes();

    await authController.resetPassword({ body: { token: 'abc', newPassword: 'GoodPass1' } }, res, jest.fn());

    const lookupArg = userQuery.findByResetToken.mock.calls[0][0];
    expect(lookupArg).toHaveLength(64);
    expect(lookupArg).not.toBe('abc');
  });
});
