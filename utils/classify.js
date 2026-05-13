// Classify a number bucket based on sender/CLI string from IVASMS row.
function classify(sender='') {
  const s = String(sender).toLowerCase();
  if (s.includes('telegram') || s.includes('tg')) return 'telegram';
  if (s.includes('whatsapp') || /\bwa\b/.test(s)) return 'whatsapp';
  if (s.includes('facebook') || /\bfb\b/.test(s) || s.includes('meta') || s.includes('instagram')) return 'facebook';
  return 'other';
}
module.exports = { classify };
