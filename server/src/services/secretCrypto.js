import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../db.js';

const ALGORITHM = 'aes-256-gcm';

export function getEncryptionKeyPath() {
  const dbPath = getDatabasePath();
  return path.join(path.dirname(dbPath), `.${path.basename(dbPath)}.encryption-key`);
}

function loadKey() {
  const keyPath = getEncryptionKeyPath();
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });

  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }

  const key = Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'hex');
  if (key.length !== 32) {
    throw new Error('Chave de criptografia local inválida. Apague o arquivo de chave só se também for limpar a credencial salva.');
  }
  return key;
}

export function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, loadKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['enc:v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSecret(payload) {
  const parts = String(payload || '').split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Credencial armazenada em formato inválido');
  }

  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const data = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskSecret(secret) {
  const value = String(secret || '');
  if (value.length < 4) return null;
  return `••••${value.slice(-4)}`;
}
