#!/usr/bin/env python3
"""Build the concept website (sandbox/site/) from site/pages/*.html, site/site.css and the built modules in dist/.

Page files start with a JSON comment: <!--{"title": "...", "nav": "schools", "sub": "grants", "description": "..."}-->
Placeholders: {{module:NAME}} (a dist/ paste-in), {{count:resources}}, {{count:webinars}}, {{latest-webinars}}.
Every page carries a banner saying it is a concept, and asks search engines not to index it.
"""
import csv, html, json, re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'site', ROOT / 'sandbox' / 'site'
CONTRACTOR = 'Jess Sutherland Management Consulting Ltd.'
NAV = [('schools', 'For schools', 'schools.html'), ('impact', 'Impact', 'impact.html'), ('about', 'About', 'about.html'),
       ('give', 'Give', 'give.html'), ('contact', 'Contact', 'contact.html'), ('later', 'Coming later', 'coming-later.html')]
SUB = [('grants', 'Grants', 'grants.html'), ('support', 'Program support', 'support.html'),
       ('resources', 'Resource library', 'resources.html'), ('webinars', 'Webinars', 'webinars.html')]
FONT = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap'


def rows():
    with (ROOT / 'data' / 'resources.csv').open(encoding='utf-8') as f:
        return list(csv.DictReader(f))


def latest_webinars(data, n=4):
    web = [r for r in data if r['type'] == 'Webinar']
    web.sort(key=lambda r: (r['date'] == '', [-int(x) for x in re.findall(r'\d+', r['date'])], r['title'].lower()))
    items = []
    for r in web[:n]:
        topic = html.escape(r['topic'].split(';')[0].strip()) if r['topic'] else 'Webinar'
        items.append(f'<li><b><a href="{html.escape(r["link"])}">{html.escape(r["title"])}</a></b>{topic}</li>')
    return '<ul class="facts">' + ''.join(items) + '</ul>'


def nav_list(current, cls='nav', label='Main'):
    lis = ''.join(
        f'<li><a href="{href}"{" aria-current=\"page\"" if key == current else ""}{" class=\"later\"" if key == "later" else ""}>{text}</a></li>'
        for key, text, href in NAV)
    return f'<nav class="{cls}" aria-label="{label}"><ul>{lis}</ul></nav>'


def layout(meta, body, page_name):
    sub = ''
    if meta.get('sub') or meta.get('nav') == 'schools':
        lis = ''.join(f'<li><a href="{href}"{" aria-current=\"page\"" if key == meta.get("sub") else ""}>{text}</a></li>'
                      for key, text, href in SUB)
        sub = f'<div class="subnav"><div class="wrap"><nav aria-label="For schools"><ul>{lis}</ul></nav></div></div>'
    title = 'Child Nutrition Council of Manitoba (concept)' if page_name == 'index' else f'{meta["title"]} · Child Nutrition Council of Manitoba (concept)'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(meta.get('description', ''))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONT}">
<link rel="stylesheet" href="site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<aside class="concept" aria-label="About this concept"><div class="wrap"><p>Concept site for discussion with Child Nutrition Council of Manitoba staff and leadership. This is not CNCM's website: visit <a href="https://www.childnutritioncouncil.com/">childnutritioncouncil.com</a>.</p></div></aside>
<header class="site-header"><div class="wrap">
  <a class="wordmark" href="index.html"><span class="mark" aria-hidden="true"></span><span>Child Nutrition Council<br>of Manitoba</span></a>
  <div class="desktop-nav">{nav_list(meta.get('nav'))}</div>
  <details class="menu mobile-nav"><summary>Menu</summary>{nav_list(meta.get('nav'), 'nav', 'Main menu')}</details>
</div></header>
{sub}
<main id="main">
{body}
</main>
<footer class="site-footer"><div class="wrap">
  <div class="cols">
    <div><h2>Child Nutrition Council of Manitoba</h2><p>Every child, every day, well nourished. Registered charity 84086 4094 RR0001.</p></div>
    <div><h2>For schools</h2><ul><li><a href="grants.html">Grants</a></li><li><a href="support.html">Program support</a></li><li><a href="resources.html">Resource library</a></li><li><a href="webinars.html">Webinars</a></li></ul></div>
    <div><h2>Organization</h2><ul><li><a href="about.html">About</a></li><li><a href="impact.html">Impact</a></li><li><a href="give.html">Give</a></li><li><a href="contact.html">Contact</a></li><li><a href="coming-later.html">Coming later</a></li></ul></div>
  </div>
  <p class="small">Concept for discussion, October 2026. Content from CNCM's public website and Annual Report 2025–26. Links to donate and join the waitlist open CNCM's current site.</p>
</div></footer>
</body>
</html>
"""


def main():
    data = rows()
    counts = {'resources': str(len(data)), 'webinars': str(sum(1 for r in data if r['type'] == 'Webinar'))}
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    shutil.copy(SRC / 'site.css', OUT / 'site.css')
    for f in sorted((SRC / 'pages').glob('*.html')):
        text = f.read_text(encoding='utf-8')
        m = re.match(r'\s*<!--(\{.*?\})-->\s*', text, re.S)
        if not m:
            raise SystemExit(f'{f.name}: missing the JSON header comment')
        meta, body = json.loads(m.group(1)), text[m.end():]
        body = re.sub(r'\{\{module:([\w-]+)\}\}', lambda x: (ROOT / 'dist' / f'{x.group(1)}.html').read_text(encoding='utf-8'), body)
        body = re.sub(r'\{\{count:(\w+)\}\}', lambda x: counts[x.group(1)], body)
        body = body.replace('{{latest-webinars}}', latest_webinars(data))
        left = re.findall(r'\{\{[^}]+\}\}', body)
        if left:
            raise SystemExit(f'{f.name}: unknown placeholder(s) {left}')
        (OUT / f.name).write_text(layout(meta, body, f.stem), encoding='utf-8')
    print(f'sandbox/site/: {len(list(OUT.glob("*.html")))} pages')


if __name__ == '__main__':
    main()
