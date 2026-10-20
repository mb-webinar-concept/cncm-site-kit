// Concept site tests: every page loads cleanly, says it is a concept, is not indexed,
// passes an accessibility scan, and every internal link and "coming later" anchor resolves.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const H = require('./helpers');

const DIR = path.join(H.ROOT, 'sandbox', 'site');
const pages = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));

async function serveSite(page) {
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== H.BASE) return route.fulfill({ status: 204, body: '' });
    const file = path.join(DIR, path.basename(u.pathname));
    if (u.pathname.startsWith('/site/') && fs.existsSync(file)) {
      const type = file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8';
      return route.fulfill({ contentType: type, body: fs.readFileSync(file) });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
}

for (const f of pages) {
  test(`concept page: ${f}`, async ({ page }) => {
    const errors = H.trackErrors(page);
    await serveSite(page);
    await page.goto(`${H.BASE}/site/${f}`);
    await expect(page.locator('.concept')).toContainText("This is not CNCM's website");
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
    const r = await new AxeBuilder({ page }).exclude('.cncm-wl').exclude('.cncm-im').analyze();
    expect(r.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('every internal link and anchor resolves', async () => {
  const ids = {};
  for (const f of pages) ids[f] = new Set([...fs.readFileSync(path.join(DIR, f), 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const broken = [];
  for (const f of pages) {
    const html = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const [, href] of html.matchAll(/href="([^"#?][^"]*?\.html)(?:\?[^"#]*)?(#[^"]*)?"/g)) {
      if (/^https?:/.test(href)) continue;
      const target = path.basename(href);
      if (!pages.includes(target)) broken.push(`${f} -> ${href}`);
    }
    for (const [, target, anchor] of html.matchAll(/href="([\w-]+\.html)#([\w-]+)"/g)) {
      if (!ids[target] || !ids[target].has(anchor)) broken.push(`${f} -> ${target}#${anchor}`);
    }
  }
  expect(broken).toEqual([]);
});

test('home page: the tray, the latest webinars and working navigation', async ({ page }) => {
  await serveSite(page);
  await page.goto(`${H.BASE}/site/index.html`);
  await expect(page.locator('.tray .slot')).toHaveCount(3);
  await expect(page.locator('main .facts li')).toHaveCount(4);
  await page.locator('.desktop-nav a', { hasText: 'For schools' }).click();
  await expect(page).toHaveURL(/schools\.html$/);
  await expect(page.locator('.subnav')).toBeVisible();
});

test('phone: menu button opens the navigation, no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await serveSite(page);
  await page.goto(`${H.BASE}/site/index.html`);
  await expect(page.locator('.desktop-nav')).toBeHidden();
  await page.locator('.mobile-nav summary').click();
  await expect(page.locator('.mobile-nav a', { hasText: 'Give' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('the libraries work inside the site', async ({ page }) => {
  await serveSite(page);
  await page.goto(`${H.BASE}/site/webinars.html`);
  await expect(page.locator('#cncm-webinar-library .wl-table tbody tr').first()).toBeVisible();
  await page.goto(`${H.BASE}/site/resources.html?rh_topic=Food+Safety`);
  await expect(page.locator('#rh-topic')).toHaveValue('Food Safety');
});

test('nothing is collected: the newsletter form is switched off', async ({ page }) => {
  await serveSite(page);
  await page.goto(`${H.BASE}/site/contact.html`);
  await expect(page.locator('#nl-email')).toBeDisabled();
});
