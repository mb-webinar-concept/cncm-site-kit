// Impact module tests, run against dist/impact.html with the real data files.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const H = require('./helpers');

const stats = H.parseCsv(H.readCsv('data/impact-stats.csv'));
const divs = H.parseCsv(H.readCsv('data/divisions.csv'));
const totals = {};
for (const d of divs) totals[d.region] = (totals[d.region] || 0) + (parseInt(d.schools_supported, 10) || 0);
const regions = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);

const impactPage = (opts) => H.page(H.dist('impact'), opts);

test('headline numbers come from the stats data, with sources', async ({ page }) => {
  const errors = H.trackErrors(page);
  await H.serve(page, '/impact', impactPage());
  await expect(page.locator('.im-stat')).toHaveCount(stats.length);
  await expect(page.locator('.im-value').first()).toHaveText(stats[0].value);
  await expect(page.locator('.im-source a').first()).toHaveAttribute('href', stats[0].source_url);
  expect(errors).toEqual([]);
});

test('region bars are computed from the division rows', async ({ page }) => {
  await H.serve(page, '/impact', impactPage());
  await expect(page.locator('.im-barlabel')).toHaveText(regions);
  await expect(page.locator('.im-barnum')).toHaveText(regions.map(r => totals[r].toLocaleString('en-CA')));
});

test('clicking a region filters the division table', async ({ page }) => {
  await H.serve(page, '/impact', impactPage());
  await expect(page.locator('.im-table tbody tr')).toHaveCount(divs.length);
  const r = regions[0];
  await page.locator('.im-barbtn', { hasText: r }).click();
  await expect(page.locator('#cncm-impact-region')).toHaveValue(r);
  await expect(page.locator('.im-table tbody tr')).toHaveCount(divs.filter(d => d.region === r).length);
});

test('division search with an empty state', async ({ page }) => {
  await H.serve(page, '/impact', impactPage());
  await page.fill('#cncm-impact-q', 'seven oaks');
  await expect(page.locator('.im-table tbody tr')).toHaveCount(divs.filter(d => /seven oaks/i.test(d.division)).length);
  await expect(page.locator('.im-table tbody th').first()).toContainText('Seven Oaks');
  await page.fill('#cncm-impact-q', 'zzzz');
  await expect(page.locator('.im-empty')).toBeVisible();
  await expect(page.locator('.im-tablewrap')).toBeHidden();
});

test('French wording on a French page', async ({ page }) => {
  await H.serve(page, '/fr', impactPage({ lang: 'fr' }));
  await expect(page.locator('label[for=cncm-impact-q]')).toHaveText('Rechercher une division');
});

test('accessibility scan', async ({ page }) => {
  await H.serve(page, '/impact', impactPage());
  const r = await new AxeBuilder({ page }).include('#cncm-impact').analyze();
  expect(r.violations.map(v => v.id)).toEqual([]);
});

test('aggressive theme and phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await H.serve(page, '/theme', impactPage({ head: H.HOSTILE_CSS }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.im-h')).textTransform)).toBe('none');
  const small = await page.evaluate(() => [...document.querySelectorAll('.cncm-im button, .cncm-im input, .cncm-im select')]
    .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height < 44).length);
  expect(small).toBe(0);
});
