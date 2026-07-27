import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM para cifrar en reposo secretos sensibles (hoy: User.twoFactorSecret). El formato
// almacenado es un solo string base64: iv(12 bytes) || authTag(16 bytes) || ciphertext, así no
// hace falta una columna nueva ni una migración.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser un string hex de 64 caracteres (32 bytes) -- ver .env.example');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(stored: string): string {
  const buffer = Buffer.from(stored, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
