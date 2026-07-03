const crypto = require('crypto');
const config = require('./config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;

/**
 * Encrypts an object or primitive type using AES-256-GCM.
 * @param {any} value - The input to encrypt.
 * @returns {string} Colon-separated format: iv:ciphertext:tag
 */
function encrypt(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Convert objects or arrays to string
  const plaintext = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // Generate random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Decrypts a colon-separated string (iv:ciphertext:tag) using AES-256-GCM.
 * @param {string} encryptedString - The encrypted text to decrypt.
 * @returns {any} Original object or string value.
 */
function decrypt(encryptedString) {
  if (!encryptedString) {
    return encryptedString;
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected iv:ciphertext:tag');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const ciphertext = parts[1];
  const tag = Buffer.from(parts[2], 'hex');
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  // Attempt to parse JSON back into original structure
  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return decrypted;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
