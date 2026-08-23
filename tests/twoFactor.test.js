process.env.JWT_SECRET = 'test-secret-for-totp-0123456789abcdef';
process.env.NVIDIA_API_KEY = 'test-key';

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
  setTemporaryPassword: jest.fn(),
  setDigestOptIn: jest.fn(),
  setTotpSecret: jest.fn(),
  enableTotp: jest.fn(),
  clearTotp: jest.fn(),
}));
jest.mock('../models/profileQuery', () => ({ upsert: jest.fn(), findByUserId: jest.fn() }));
jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn(), on: jest.fn() }));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));
jest.mock('../utils/email', () => ({
  sendResetEmail: jest.fn(),
  sendTempPasswordEmail: jest.fn(),
  isEmailConfigured: jest.fn(() => true),
}));

const { authenticator } = require('otplib');
const { encrypt, decrypt } = require('../utils/crypto');
const authController = require('../controllers/authController');
const userQuery = require('../models/userQuery');

function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

const USER = {
  id: 5,
  email: 'totp@x.co',
  // Real bcrypt hash of 'Whatever1' so positive-path password compares pass.
  password_hash: require('bcryptjs').hashSync('Whatever1', 10),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('secret encryption at rest (D2)', () => {
  test('round-trips a TOTP seed and never stores plaintext', () => {
    const secret = authenticator.generateSecret();
    const enc = encrypt(secret);

    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  test('tampered ciphertext fails authentication instead of returning junk', () => {
    const enc = encrypt('seed-value');
    const raw = Buffer.from(enc, 'base64');
    raw[raw.length - 1] ^= 0xff;
    expect(() => decrypt(raw.toString('base64'))).toThrow();
  });
});

describe('TOTP enrollment (D2)', () => {
  test('start stores an encrypted seed and returns a scannable otpauth URL', async () => {
    const res = mkRes();

    await authController.startTotpEnroll({ user: USER }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(res._.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Stored value must be ciphertext, decryptable to a valid base32 seed.
    const stored = userQuery.setTotpSecret.mock.calls[0][1];
    expect(stored).not.toMatch(/^[A-Z2-7]+$/); // not raw base32
    expect(authenticator.generateSecret).toBeTruthy();
    expect(decrypt(stored)).toMatch(/^[A-Z2-7]{16,}$/);
  });

  test('confirm activates only with a code the real seed produces', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    userQuery.setTotpSecret.mockResolvedValue({ id: 5 });
    await authController.startTotpEnroll({ user: USER }, res_placeholder(), jest.fn());
    const storedEnc = userQuery.setTotpSecret.mock.calls[0][1];
    userQuery.findById.mockResolvedValue({ ...USER, totp_secret_enc: storedEnc });
    userQuery.enableTotp.mockResolvedValue({ id: 5 });

    function res_placeholder() { return mkRes(); }

    // Wrong code first.
    const badRes = mkRes();
    await authController.confirmTotpEnroll(
      { user: USER, body: { token: '000000' } }, badRes, jest.fn()
    );
    if (badRes._.code === 200) throw new Error('wrong code accepted — otplib window unexpectedly wide?');

    // Real code from the same seed.
    const token = authenticator.generate(decrypt(storedEnc));
    const goodRes = mkRes();
    await authController.confirmTotpEnroll(
      { user: USER, body: { token } }, goodRes, jest.fn()
    );

    expect(goodRes._.code).toBe(200);
    expect(userQuery.enableTotp).toHaveBeenCalledWith(5);
  });
});

describe('login two-factor challenge (D2)', () => {
  test('password alone yields twoFactorRequired and NEVER a token', async () => {
    const secret = authenticator.generateSecret();
    userQuery.findByEmail.mockResolvedValue({
      ...USER,
      totp_enabled: true,
      totp_secret_enc: encrypt(secret),
    });

    const res = mkRes();
    await authController.login({ body: { email: 'totp@x.co', password: 'Whatever1' } }, res, jest.fn());

    expect(res._.code).toBe(200);
    expect(res._.body.twoFactorRequired).toBe(true);
    expect(res._.body.token).toBeUndefined();
    expect(res._.body.user).toBeUndefined();
  });

  test('valid second step issues the JWT', async () => {
    const secret = authenticator.generateSecret();
    userQuery.findByEmail.mockResolvedValue({
      id: 5, email: 'totp@x.co',
      password_hash: USER.password_hash,
      totp_enabled: true,
      totp_secret_enc: encrypt(secret),
    });

    const wrongRes = mkRes();
    await authController.login(
      { body: { email: 'totp@x.co', password: 'Whatever1', token: '111111' } },
      wrongRes, jest.fn()
    );
    expect(wrongRes._.code).toBe(401);
    expect(wrongRes._.body.error).toMatch(/two-factor/i);

    const token = authenticator.generate(secret);
    const goodRes = mkRes();
    await authController.login(
      { body: { email: 'totp@x.co', password: 'Whatever1', token } },
      goodRes, jest.fn()
    );
    expect(typeof goodRes._.body.token).toBe('string');
  });
});
