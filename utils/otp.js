// Extract OTP from message text. Supports 4-8 digit numeric, alphanumeric.
const PATTERNS = [
  /\b(\d{4,8})\b/,
  /\b([A-Z0-9]{4,8})\b/,
];
function extractOTP(text='') {
  if (!text) return null;
  // strip common prefixes
  const t = String(text).replace(/[^\w\s]/g,' ');
  for (const p of PATTERNS) {
    const m = t.match(p);
    if (m) return m[1];
  }
  return null;
}
module.exports = { extractOTP };
