// src/utils/encryption.js
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class EncryptionService {
  private key: Buffer = Buffer.alloc(32);
  private encryptionKey = process.env.ENCRYPTION_KEY;

  constructor() {
    if (this.encryptionKey) {
      this.key = scryptSync(this.encryptionKey, 'salt', 32);
    }
  }

  encrypt(plaintext: string) {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  decrypt(payload: { iv?: string; data?: string; tag?: string }) {
    if (!payload.tag || !payload.iv || !payload.data) {
      throw new Error('Invalid payload for decryption');
    }
    
    const iv = Buffer.from(payload.iv, 'hex');
    const tag =  Buffer.from(payload.tag, 'hex');
    const decipher = createDecipheriv(ALGO, this.key, iv, { authTagLength: TAG_LENGTH });

    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

export const encryptionService = new EncryptionService();