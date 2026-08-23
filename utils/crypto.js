const crypto = require('crypto');

/*
  Symmetric encryption for secrets at rest (TOTP seeds). The key is derived
  from JWT_SECRET, so it is deployment-specific without a second environment
  variable, and rotating the JWT secret also rotates this key.

  Format: base64( iv[12] || authTag[16] || ciphertext )
*/

function getKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to encrypt secrets at rest.');
  return crypto.createHash('sha256').update(`cv-builder:${secret}`).digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypt an encrypted payload. Throws on tampering (auth tag mismatch) —
 * callers must treat that as "no valid secret stored".
 */
function decrypt(payload) {
  const raw = Buffer.from(String(payload), 'base64');
  if (raw.length < 12 + 16 + 1) throw new Error('Encrypted payload is truncated.');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
