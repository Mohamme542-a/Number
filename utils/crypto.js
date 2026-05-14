const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
function key() {
  const k = process.env.ENCRYPTION_KEY || '';
  if (k.length < 32) throw new Error('ENCRYPTION_KEY must be at least 32 chars');
  return crypto.createHash('sha256').update(k).digest();
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
function hashMessage({ number, sender, message, received_at }) {
  return crypto.createHash('sha256')
    .update(`${number||''}|${sender||''}|${message||''}|${received_at||''}`)
    .digest('hex');
}
module.exports = { encrypt, decrypt, hashMessage };
