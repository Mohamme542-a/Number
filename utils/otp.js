// OTP extractor: tries common patterns first, falls back to numeric runs.
function extractOtp(text) {
  if (!text) return null;
  const patterns = [
    /\b(?:code|otp|pin|verification)[^\d]{0,15}(\d{4,8})\b/i,
    /\b(\d{6})\b/,
    /\b(\d{5})\b/,
    /\b(\d{4})\b/,
    /\b(\d{7,8})\b/,
    /\b([A-Z0-9]{5,8})\b/
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}
module.exports = { extractOtp };
