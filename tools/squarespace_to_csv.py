#!/usr/bin/env python3
"""Turn CNCM's Squarespace Resource Hub export into data/resources.csv.

Usage:
  python3 tools/squarespace_to_csv.py                      # uses data/source/resources-squarespace.json
  python3 tools/squarespace_to_csv.py --fetch              # downloads a fresh copy first (needs internet)

The export is what Squarespace serves at /resources?format=json (plus one call per category).
Rules used to fill each column are written out below so staff can check them.
Manual corrections go in data/overrides.csv (matched by page URL) and always win.
"""
import csv, json, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data/source/resources-squarespace.json'
OVR = ROOT / 'data/overrides.csv'
OUT = ROOT / 'data/resources.csv'
SITE = 'https://www.childnutritioncouncil.com'
COLUMNS = ['title', 'date', 'topic', 'presenter', 'description', 'link', 'resources', 'region', 'language', 'type']
BOILER = re.compile(r'>>\s*[^<]{0,40}<<|‍|​')


def fetch():
    def get(u):
        with urllib.request.urlopen(u, timeout=30) as r:
            return json.load(r)
    j = get(SITE + '/resources?format=json')
    cats = {}
    for c in j['nestedCategories']['categories']:
        for it in get(SITE + c['fullUrl'] + '?format=json')['items']:
            cats.setdefault(it['fullUrl'], []).append(c['displayName'])
    items = []
    for it in j['items']:
        html = it.get('excerpt') or ''
        links = [{'href': h, 'text': ''} for h in re.findall(r'href="([^"]+)"', html)]
        text = re.sub(r'<[^>]+>', ' ', html)
        items.append({'title': it['title'], 'url': SITE + it['fullUrl'], 'categories': cats.get(it['fullUrl'], []),
                      'tags': it.get('tags') or [], 'excerptText': re.sub(r'\s+', ' ', text).strip(), 'excerptLinks': links})
    SRC.write_text(json.dumps({'source': SITE + '/resources?format=json', 'items': items}, indent=1, ensure_ascii=False))


def clean_title(t):
    return re.sub(r'^\s*webinar\s*[-:–]\s*', '', t, flags=re.I).strip()


def short(text, n=220):
    text = re.sub(r'\s+', ' ', BOILER.sub(' ', text)).strip()
    text = re.sub(r'Check out additional guides for school food programs:.*$', '', text).strip()
    text = re.sub(r'For any recommendations provided, please refer to your school and divisional allergy polic[^.]*\.?', '', text).strip()
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(' ', 1)[0]
    return cut.rstrip(',;:') + '…'


def row(it):
    cats = it['categories']
    kind = 'Webinar' if ('Webinars' in cats or it['title'].lower().startswith('webinar')) else \
           'Recipe' if 'Recipes' in cats else 'Guide'
    topics = [c for c in cats if c not in ('Webinars', 'Recipes')]
    direct = next((l['href'] for l in it['excerptLinks']
                   if l['href'].startswith('http') and '/resources/p/' not in l['href']), '')
    return {
        'title': clean_title(it['title']),
        'date': '',  # Squarespace's "added on" date is a bulk-import date, not a publication date
        'topic': '; '.join(topics),
        'presenter': '',
        'description': short(it['excerptText']),
        # Webinars open CNCM's own page first (recordings can expire); other items open the file directly
        'link': it['url'] if (kind == 'Webinar' or not direct) else direct,
        'resources': (direct if kind == 'Webinar' else it['url']) if direct else '',
        'region': '',
        'language': 'English and French' if 'French' in it['tags'] else 'English',
        'type': kind,
    }


def main():
    if '--fetch' in sys.argv:
        fetch()
    data = json.loads(SRC.read_text())
    rows = {}
    for it in data['items']:
        rows[it['url']] = row(it)
    if OVR.exists():
        with OVR.open(newline='', encoding='utf-8') as f:
            for o in csv.DictReader(f):
                r = rows.get(o['page_url'].strip())
                if r is None:
                    print('override not matched:', o['page_url'], file=sys.stderr)
                    continue
                for k, v in o.items():
                    if k in COLUMNS and v.strip():
                        r[k] = v.strip()
    out = sorted(rows.values(), key=lambda r: (r['type'], r['title'].lower()))
    with OUT.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(out)
    print(f'wrote {len(out)} rows to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
