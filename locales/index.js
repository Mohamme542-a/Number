const ar = require('./ar.json');
const en = require('./en.json');
const dict = { ar, en };
function t(lang, key, vars={}) {
  const d = dict[lang] || dict.ar;
  let s = d[key] || key;
  for (const [k,v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
module.exports = { t, dict };
