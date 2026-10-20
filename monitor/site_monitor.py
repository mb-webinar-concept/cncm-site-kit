#!/usr/bin/env python3
"""Weekly site monitor: a passive check of a public website, written up as a plain-language report.

  python3 monitor/site_monitor.py                       # every enabled site in monitor/config.json
  python3 monitor/site_monitor.py --url https://example.org/ --out report.md

What it checks (public pages only, nothing is submitted, one request per second, robots.txt respected):
  Pages      every page in sitemap.xml (or found by following internal links): errors, slow pages, redirects
  Links      broken internal and external links
  Security   HTTPS everywhere, HSTS and other protective headers, insecure (http://) images, scripts and
             forms, scripts loaded from hosts not seen before, links opening new tabs without protection
  Content    spelling (codespell, if installed), statistics citing old years, images without alt text,
             missing page titles and descriptions, email addresses exposed to spam harvesters
It never tries to log in, guess passwords, probe for weaknesses or load anything behind a form.
Only the Python standard library is required.
"""
import argparse, datetime as dt, json, re, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request
import urllib.robotparser
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urldefrag, urlparse

HERE = Path(__file__).resolve().parent
YEAR = dt.date.today().year
SEC_HEADERS = {
    'strict-transport-security': 'HSTS (forces browsers to use HTTPS)',
    'x-content-type-options': 'X-Content-Type-Options (stops file-type guessing attacks)',
    'content-security-policy': 'Content-Security-Policy (limits where scripts may load from)',
    'referrer-policy': 'Referrer-Policy (limits what is shared with other sites)',
}


class Page(HTMLParser):
    """Collects what the checks need from one HTML page."""
    def __init__(self, url):
        super().__init__(convert_charrefs=True)
        self.url, self.links, self.scripts, self.insecure, self.forms = url, [], [], [], []
        self.imgs_no_alt, self.blank_no_opener, self.text, self.title = 0, 0, [], ''
        self.description, self.h1, self._skip, self._in_title = False, 0, 0, False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style', 'noscript', 'template'):
            self._skip += 1
        if tag == 'title':
            self._in_title = True
        if tag == 'h1':
            self.h1 += 1
        if tag == 'meta' and (a.get('name') or '').lower() == 'description' and (a.get('content') or '').strip():
            self.description = True
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
            if (a.get('target') or '').lower() == '_blank' and 'noopener' not in (a.get('rel') or '') \
                    and 'noreferrer' not in (a.get('rel') or ''):
                self.blank_no_opener += 1
        if tag == 'script' and a.get('src'):
            self.scripts.append(urljoin(self.url, a['src']))
        for key in ('src', 'href', 'action'):
            v = a.get(key) or ''
            if v.startswith('http://') and tag in ('script', 'img', 'iframe', 'link', 'form', 'source', 'video', 'audio'):
                self.insecure.append(f'<{tag} {key}="{v[:120]}">')
        if tag == 'form':
            self.forms.append(urljoin(self.url, a.get('action') or self.url))
        if tag == 'img' and 'alt' not in a:
            self.imgs_no_alt += 1

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'template') and self._skip:
            self._skip -= 1
        if tag == 'title':
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip and data.strip():
            self.text.append(data.strip())


class Monitor:
    def __init__(self, cfg):
        self.cfg, self.last = cfg, 0.0
        self.ua = cfg.get('user_agent', 'site-monitor/1.0')
        self.delay = float(cfg.get('delay_seconds', 1.0))
        self.robots = {}

    def allowed(self, url):
        p = urlparse(url)
        base = f'{p.scheme}://{p.netloc}'
        if base not in self.robots:
            rp = urllib.robotparser.RobotFileParser(base + '/robots.txt')
            try:
                rp.read()
            except Exception:
                rp = None
            self.robots[base] = rp
        rp = self.robots[base]
        return True if rp is None else rp.can_fetch(self.ua, url)

    def fetch(self, url, method='GET'):
        wait = self.delay - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        self.last = time.time()
        req = urllib.request.Request(url, method=method, headers={'User-Agent': self.ua, 'Accept': 'text/html,*/*'})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                body = r.read(3_000_000) if method == 'GET' else b''
                return {'status': r.status, 'url': r.geturl(), 'headers': {k.lower(): v for k, v in r.headers.items()},
                        'body': body, 'secs': time.time() - t0}
        except urllib.error.HTTPError as e:
            return {'status': e.code, 'url': url, 'headers': {k.lower(): v for k, v in (e.headers or {}).items()},
                    'body': b'', 'secs': time.time() - t0}
        except Exception as e:
            return {'status': None, 'url': url, 'headers': {}, 'body': b'', 'secs': time.time() - t0, 'error': str(e)[:160]}

    def discover(self, start):
        root = urlparse(start)
        sm = self.fetch(f'{root.scheme}://{root.netloc}/sitemap.xml')
        urls = []
        if sm['status'] == 200 and b'<loc>' in sm['body']:
            urls = [u.strip() for u in re.findall(r'<loc>([^<]+)</loc>', sm['body'].decode('utf-8', 'replace'))]
            urls = [u for u in urls if urlparse(u).netloc == root.netloc and not u.endswith('.xml')]
        return urls or [start]

    def run_site(self, site):
        start = site['start_url']
        host = urlparse(start).netloc
        prefix = start if start.endswith('/') else start + '/'
        queue, seen, pages = self.discover(start), set(), []
        if start not in queue:
            queue.insert(0, start)
        internal_links, external_links = {}, {}
        while queue and len(pages) < int(self.cfg.get('max_pages', 150)):
            url = urldefrag(queue.pop(0))[0]
            if url in seen:
                continue
            seen.add(url)
            if not self.allowed(url):
                continue
            r = self.fetch(url)
            entry = {'url': url, 'status': r['status'], 'secs': round(r['secs'], 2), 'final': r['url'],
                     'headers': r['headers'], 'error': r.get('error')}
            ctype = r['headers'].get('content-type', '')
            if r['status'] == 200 and 'html' in ctype:
                p = Page(r['url'])
                try:
                    p.feed(r['body'].decode('utf-8', 'replace'))
                except Exception:
                    pass
                entry['page'] = p
                for href in p.links:
                    if href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
                        continue
                    target = urldefrag(urljoin(r['url'], href))[0]
                    t = urlparse(target)
                    if t.scheme not in ('http', 'https'):
                        continue
                    if t.netloc == host:
                        internal_links.setdefault(target, set()).add(url)
                        if target.startswith(prefix) and target not in seen and target not in queue \
                                and not re.search(r'\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|pptx?|csv)$', t.path, re.I):
                            queue.append(target)
                    else:
                        external_links.setdefault(target, set()).add(url)
            pages.append(entry)
        broken = []
        for link, sources in sorted(internal_links.items()):
            if link in seen:
                st = next((p['status'] for p in pages if p['url'] == link), None)
            else:
                st = self.fetch(link, 'HEAD')['status'] if self.allowed(link) else 'robots'
            if st not in (200, 'robots') and not (isinstance(st, int) and 300 <= st < 400):
                broken.append((link, st, sorted(sources)[:3]))
        ext_checked = 0
        for link, sources in sorted(external_links.items()):
            if ext_checked >= int(self.cfg.get('max_external_links', 300)):
                break
            ext_checked += 1
            r = self.fetch(link, 'HEAD')
            if r['status'] in (405, 403, 501):  # some servers refuse HEAD; try GET once
                r = self.fetch(link)
            if r['status'] is None or r['status'] >= 400:
                broken.append((link, r['status'] or r.get('error', 'no response'), sorted(sources)[:3]))
        return {'site': site, 'pages': pages, 'broken': broken, 'external_count': len(external_links), 'ext_checked': ext_checked}


def spelling(pages, ignore):
    if not shutil.which('codespell'):
        return None
    hits = []
    with tempfile.TemporaryDirectory() as d:
        files = {}
        for i, p in enumerate(pages):
            if p.get('page'):
                f = Path(d) / f'p{i}.txt'
                f.write_text('\n'.join(p['page'].text), encoding='utf-8')
                files[f.name] = p['url']
        if not files:
            return []
        cmd = ['codespell', '--quiet-level', '3', '--ignore-words-list', ','.join(ignore), d]
        out = subprocess.run(cmd, capture_output=True, text=True).stdout
        for line in out.splitlines():
            m = re.match(r'.*/(p\d+\.txt):\d+: (.+)$', line)
            if m:
                hits.append((files.get(m.group(1), '?'), m.group(2)))
    return hits


def analyse(res, cfg):
    site, pages = res['site'], res['pages']
    act, look, fyi, no_desc = [], [], [], []
    ok_pages = [p for p in pages if p.get('page')]
    for p in pages:
        if p['status'] is None:
            act.append(f"Page did not respond: {p['url']} ({p.get('error')})")
        elif p['status'] >= 400:
            act.append(f"Page returns error {p['status']}: {p['url']}")
        elif p['secs'] > 4:
            look.append(f"Slow page ({p['secs']} s): {p['url']}")
    for link, st, src in res['broken']:
        if isinstance(st, int):
            act.append(f"Broken link ({st}): {link} — on {', '.join(src)}")
        else:  # no answer at all: often a network hiccup, so check by hand before fixing
            look.append(f"Could not reach link ({st}): {link} — on {', '.join(src)}")
    if urlparse(site['start_url']).scheme != 'https':
        act.append('The site address does not use HTTPS.')
    first = next((p for p in pages if p['status'] == 200), None)
    if first:
        missing = [label for h, label in SEC_HEADERS.items() if h not in first['headers']]
        if missing:
            look.append('Protective headers not sent (set by the hosting platform; worth asking about): ' + '; '.join(missing))
    hosts = sorted({urlparse(s).netloc for p in ok_pages for s in p['page'].scripts if urlparse(s).netloc})
    known = set(site.get('known_script_hosts', []))
    page_host = urlparse(site['start_url']).netloc
    new_hosts = [h for h in hosts if h not in known and h != page_host]
    if new_hosts:
        act.append('Scripts now load from new outside sources (confirm each was added on purpose): ' + ', '.join(new_hosts))
    fyi.append('Script sources in use: ' + (', '.join(hosts) if hosts else 'none found'))
    for p in ok_pages:
        pg = p['page']
        if pg.insecure:
            act.append(f"Insecure (http://) content on {p['url']}: {pg.insecure[0]}" + (f' and {len(pg.insecure) - 1} more' if len(pg.insecure) > 1 else ''))
        for f in pg.forms:
            if f.startswith('http://'):
                act.append(f"A form sends data without encryption on {p['url']}")
        if pg.blank_no_opener:
            look.append(f"{pg.blank_no_opener} link(s) open a new tab without rel=noopener on {p['url']}")
        if not pg.title.strip():
            look.append(f"Page has no title: {p['url']}")
        if not pg.description:
            no_desc.append(p['url'])
        if pg.imgs_no_alt:
            look.append(f"{pg.imgs_no_alt} image(s) without alt text on {p['url']}")
        text = ' '.join(pg.text)
        old = sorted({int(y) for y in re.findall(r'\((?:[^()]{0,60}?,\s*)?((?:19|20)\d\d)\)', text)
                      if YEAR - int(y) >= int(cfg.get('stale_year_threshold', 5))})
        if old:
            look.append(f"Statistics cite older years ({', '.join(map(str, old))}) on {p['url']}; check for newer figures")
        emails = sorted(set(re.findall(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)))
        if emails:
            fyi.append(f"Email address(es) shown as plain text on {p['url']}: {', '.join(emails[:3])}")
    if no_desc:
        fyi.append(f"{len(no_desc)} page(s) have no search description, for example {no_desc[0]}")
    sp = spelling(pages, cfg.get('ignore_words', []))
    if sp is None:
        fyi.append('Spelling not checked (install codespell).')
    else:
        for url, msg in sp[:40]:
            look.append(f"Possible spelling error on {url}: {msg}")
    return act, look, fyi, len(ok_pages)


def report(results, cfg):
    lines = [f"# Site health report, {dt.date.today().isoformat()}", '',
             'Passive weekly check: public pages only, nothing submitted. '
             '**Action needed** items should be fixed; **worth a look** items need a judgement; **FYI** items are for the record.', '']
    total_act = 0
    for res in results:
        act, look, fyi, n = analyse(res, cfg)
        total_act += len(act)
        lines += [f"## {res['site']['name']}", '', f"{res['site']['start_url']} · {n} pages read · "
                  f"{res['ext_checked']} of {res['external_count']} outside links checked", '']
        for title, items in (('Action needed', act), ('Worth a look', look), ('FYI', fyi)):
            lines.append(f'### {title} ({len(items)})')
            lines += [f'- [ ] {i}' if title != 'FYI' else f'- {i}' for i in items] or ['- Nothing found.']
            lines.append('')
    lines += ['---', 'To ask the webmaster agent to fix items: comment `@claude please fix:` and list them. '
              'It opens a pull request; nothing changes until a person approves and merges it.']
    return '\n'.join(lines) + '\n', total_act


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default=str(HERE / 'config.json'))
    ap.add_argument('--url', help='check this one site instead of the config list')
    ap.add_argument('--out', default='site-report.md')
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text())
    sites = [{'name': a.url, 'start_url': a.url, 'enabled': True, 'known_script_hosts': []}] if a.url \
        else [s for s in cfg['sites'] if s.get('enabled')]
    mon = Monitor(cfg)
    results = [mon.run_site(s) for s in sites]
    text, n_act = report(results, cfg)
    Path(a.out).write_text(text, encoding='utf-8')
    print(text)
    print(f'ACTION_ITEMS={n_act}')


if __name__ == '__main__':
    main()
