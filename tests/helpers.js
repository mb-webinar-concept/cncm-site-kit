// Shared helpers: build test pages from the real paste-in files in dist/, served through
// Playwright routing at https://cncm.test/ so behaviour matches a real website.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://cncm.test';

const HOSTILE_CSS = `<style>
body{font-family:Georgia,serif;font-size:19px;color:#333;background:#fffaf0}
a{color:#c00;text-decoration:none;border-bottom:3px solid #c00}
h1,h2,h3,h4{font-size:58px;text-transform:uppercase;letter-spacing:6px;color:#00f;margin:60px 0}
p{margin:30px 0;font-size:24px} ul,li{list-style:square;margin:20px;padding:20px}
input,select,button{font-size:30px;padding:30px;border:6px double purple;background:#ffd;text-transform:uppercase}
label{display:block;font-size:40px;margin:30px 0;text-transform:uppercase}
table,th,td{border:4px solid red;font-size:28px;padding:20px}</style>`;

function dist(name) {
  return fs.readFileSync(path.join(ROOT, 'dist', `${name}.html`), 'utf8');
}

function readCsv(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Minimal CSV parser for test expectations (same rules as the modules).
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; rows.push(row); row = []; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const good = rows.filter(r => r.some(x => x.trim() !== ''));
  const head = good[0].map(h => h.trim().toLowerCase());
  return good.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

function withData(block, id, csv) {
  const re = new RegExp(`(<script type="text/plain" id="${id}">)[\\s\\S]*?(</script>)`);
  if (!re.test(block)) throw new Error(`data block ${id} not found`);
  return block.replace(re, (m, a, b) => `${a}\n${csv}${b}`);
}

function withConfig(block, extra) {
  // Append settings at the end of the CONFIG object, so they win over earlier keys.
  const add = Object.entries(extra).map(([k, v]) => `, "${k}": ${JSON.stringify(v)}`).join('');
  const re = /(var CONFIG = \{[\s\S]*?)(\n  \};\n  \/\* -)/;
  if (!re.test(block)) throw new Error('CONFIG block not found');
  return block.replace(re, (m, a, b) => a + add + b);
}

function page(body, { lang = 'en', head = '' } = {}) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>Test</title>${head}</head><body>${body}</body></html>`;
}

// Serve html at BASE+urlPath (plus extra files), answer anything else with an empty 204.
async function serve(pw, urlPath, html, extra = {}) {
  await pw.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.fulfill({ status: 204, body: '' });
    if (u.pathname === urlPath.split('?')[0]) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    if (extra[u.pathname]) {
      const e = extra[u.pathname];
      return route.fulfill(typeof e === 'string' ? { contentType: 'text/csv; charset=utf-8', body: e } : e);
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await pw.goto(BASE + urlPath);
}

function trackErrors(pw) {
  const errors = [];
  pw.on('pageerror', e => errors.push(String(e)));
  pw.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

module.exports = { ROOT, BASE, HOSTILE_CSS, dist, readCsv, parseCsv, withData, withConfig, page, serve, trackErrors };
