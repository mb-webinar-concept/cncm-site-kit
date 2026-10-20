#!/usr/bin/env python3
"""Build paste-in files (dist/) and test pages (sandbox/) from modules/, instances/ and data/.

  python3 tools/build.py

Each instance in instances/*.json becomes dist/<name>.html: one self-contained block of
HTML, CSS, data and JavaScript to paste into a Squarespace Code Block. No external files,
no tracking, no build tools needed on CNCM's side.
"""
import csv, io, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST, SANDBOX = ROOT / 'dist', ROOT / 'sandbox'
VERSION = (ROOT / 'VERSION').read_text().strip()

HOSTILE_CSS = """<style>/* Imitates an aggressive site theme, to prove the modules keep their own look */
body{font-family:Georgia,serif;font-size:19px;color:#333;background:#fffaf0;margin:0;padding:24px}
a{color:#c00;text-decoration:none;border-bottom:3px solid #c00}
h1,h2,h3,h4{font-size:58px;text-transform:uppercase;letter-spacing:6px;color:#00f;margin:60px 0}
p{margin:30px 0;font-size:24px} ul,li{list-style:square;margin:20px;padding:20px}
input,select,button{font-size:30px;padding:30px;border:6px double purple;background:#ffd;text-transform:uppercase}
label{display:block;font-size:40px;margin:30px 0;text-transform:uppercase}
table,th,td{border:4px solid red;font-size:28px;padding:20px}</style>"""


def csv_text(path, only=None):
    text = (ROOT / path).read_text(encoding='utf-8')
    if not only:
        return text.strip() + '\n'
    rows = list(csv.DictReader(io.StringIO(text)))
    keep = [r for r in rows if all(r.get(k, '') == v for k, v in only.items())]
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=list(rows[0].keys()), lineterminator='\n')
    w.writeheader(); w.writerows(keep)
    return out.getvalue()


def paste_in(name, inst):
    mod = ROOT / 'modules' / inst['module']
    css = (mod / f"{inst['module']}.css").read_text()
    js = (mod / f"{inst['module']}.js").read_text()
    cfg = json.dumps(inst['config'], ensure_ascii=False, indent=2).replace('</', '<\\/')
    cfg = '\n'.join(('  ' + l if i else l) for i, l in enumerate(cfg.split('\n')))
    js = js.replace('/*@CONFIG*/{}/*@END*/', cfg)
    assert 'CONFIG = {' in js or 'CONFIG = {\n' in js, 'config placeholder missing'
    data_blocks = []
    for d in inst['data']:
        body = csv_text(d['file'], d.get('only'))
        if re.search(r'</script', body, re.I):
            raise SystemExit(f"{d['file']} contains '</script', which would break the page")
        data_blocks.append(f'<script type="text/plain" id="{d["id"]}">\n{body}</script>')
    root_id = inst['config']['rootId']
    return f"""<!--
  CNCM {inst['title']} · site kit v{VERSION} · built from instances/{name}.json
  Paste this ENTIRE block into a Squarespace Code Block (Add Block > Code, turn OFF "Display Source").
  Edit content in the DATA block(s) below, or set a Google Sheet CSV link in CONFIG. See docs/STAFF-GUIDE.md.
-->
<div id="{root_id}" class="{inst['rootClass']}" role="region" aria-label="{inst['title']}">
  <noscript><p>{inst['fallback']}</p></noscript>
</div>
<style>
{css.rstrip()}
</style>
<!-- DATA: one row per line, first line is the header. Wrap a value in "double quotes" if it contains a comma. -->
{chr(10).join(data_blocks)}
<script>
{js.rstrip()}
</script>
"""


def page(title, body, lang='en', head=''):
    return (f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>{head}</head>'
            f'<body>{body}</body></html>\n')


def main():
    DIST.mkdir(exist_ok=True); SANDBOX.mkdir(exist_ok=True)
    links = []
    for f in sorted((ROOT / 'instances').glob('*.json')):
        name, inst = f.stem, json.loads(f.read_text())
        block = paste_in(name, inst)
        (DIST / f'{name}.html').write_text(block)
        (SANDBOX / 'dist').mkdir(exist_ok=True)
        (SANDBOX / 'dist' / f'{name}.html').write_text(block)
        variants = [('', 'en', '', 'Plain page'), ('-fr', 'fr-CA', '', 'French page'), ('-theme', 'en', HOSTILE_CSS, 'Aggressive theme')]
        for suffix, lang, head, label in variants:
            (SANDBOX / f'{name}{suffix}.html').write_text(page(f"{inst['title']} · {label}", block, lang, head))
        links.append((inst['title'], name, variants))
        print(f'dist/{name}.html  {len(block):,} bytes')
    items = ''.join(
        f'<li><b>{t}</b>: ' + ' · '.join(f'<a href="{n}{s}.html">{lbl}</a>' for s, _, _, lbl in v) +
        f' · <a href="dist/{n}.html">paste-in file</a></li>' for t, n, v in links)
    (SANDBOX / 'index.html').write_text(page(
        'CNCM site kit sandbox',
        '<main style="font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.6">'
        f'<h1>CNCM site kit sandbox</h1><p>Version {VERSION}. Every module on a plain page, a French page and a page '
        'with an aggressive theme. These are the same files that get pasted into Squarespace.</p>'
        f'<p><a href="site/index.html"><b>Open the concept website</b></a>: every page of a possible new CNCM site, with these modules in place.</p>'
        f'<ul>{items}</ul></main>'))
    import build_site
    build_site.main()


if __name__ == '__main__':
    main()
