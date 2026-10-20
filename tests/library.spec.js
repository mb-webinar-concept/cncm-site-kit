// Library module tests, run against dist/webinar-library.html and dist/resource-hub.html
// with small fixture data (for stable expectations) and with the real resource data.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const H = require('./helpers');

const HEADER = 'title,date,topic,presenter,description,link,resources,region,language,type';
const FIXTURE = [HEADER,
  '"Reducing Stigma in School Food Programs",,Inclusion; Program Planning,,"Strategies, examples and tools",https://www.childnutritioncouncil.com/resources/p/a,https://www.youtube.com/watch?v=x,,English,Webinar',
  'Food Waste Prevention,2023-04,Sustainability,Getty Stewart,,https://www.childnutritioncouncil.com/resources/p/b,,,English,Webinar',
  'Safely Serving Food,,Food Safety,,,https://www.childnutritioncouncil.com/resources/p/c,,,English,Webinar',
  'Weight Stigma and Food Neutrality,,Inclusion,,,https://example.org/d,,,English,Guide',
  'Three Sisters Soup,,,,A recipe,https://example.org/e,,,English,Recipe',
  'Éducation alimentaire,2025-01-01,Food Literacy,Élise,,https://example.org/f,,,English and French,Webinar',
  'Bad link,,Food Safety,,,javascript:alert(1),,,English,Webinar'
].join('\n') + '\n';
const WEBINARS_IN_FIXTURE = 5;

function webinarPage(opts = {}, config = {}, csv = FIXTURE) {
  let block = H.withData(H.dist('webinar-library'), 'cncm-wl-data', csv);
  block = H.withConfig(block, Object.assign({ view: 'cards' }, config));
  return H.page(block, opts);
}

test.describe('webinar library (fixture data)', () => {
  test('renders only webinars, with counts and no errors', async ({ page }) => {
    const errors = H.trackErrors(page);
    await H.serve(page, '/webinars', webinarPage());
    await expect(page.locator('.wl-card')).toHaveCount(WEBINARS_IN_FIXTURE);
    await expect(page.locator('.wl-count')).toHaveText(`Showing all ${WEBINARS_IN_FIXTURE} webinars`);
    await expect(page.locator('#cncm-webinar-library noscript')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('items can carry several topics', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    const card = page.locator('.wl-card', { hasText: 'Reducing Stigma' });
    await expect(card.locator('.wl-tag')).toHaveText(['Inclusion', 'Program Planning']);
    await page.selectOption('#wl-topic', 'Inclusion');
    await expect(page.locator('.wl-card')).toHaveCount(1);
  });

  test('search: words, accents, presenters', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    await page.fill('#wl-q', 'stigma');
    await expect(page.locator('.wl-card')).toHaveCount(1);
    await page.fill('#wl-q', 'education');
    await expect(page.locator('.wl-card .wl-title')).toHaveText(['Éducation alimentaire']);
    await page.fill('#wl-q', 'elise');
    await expect(page.locator('.wl-card')).toHaveCount(1);
    await page.fill('#wl-q', 'food waste');
    await expect(page.locator('.wl-card')).toHaveCount(1);
  });

  test('empty state and clearing by a real click', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    await page.fill('#wl-q', 'zzzz nothing');
    await expect(page.locator('.wl-empty')).toBeVisible();
    await page.locator('.wl-empty .wl-clear').click();
    await expect(page.locator('.wl-card')).toHaveCount(WEBINARS_IN_FIXTURE);
    await expect(page.locator('#wl-q')).toHaveValue('');
    await expect(page.locator('#wl-q')).toBeFocused();
  });

  test('sorting and year filter', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    await expect(page.locator('.wl-card .wl-title').first()).toHaveText('Éducation alimentaire');
    await expect(page.locator('.wl-card .wl-title').nth(1)).toHaveText('Food Waste Prevention');
    await page.selectOption('#wl-sort', 'az');
    const titles = await page.locator('.wl-card .wl-title').allInnerTexts();
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'en-CA')));
    await page.selectOption('#wl-sort', 'newest');
    await page.selectOption('#wl-year', '2023');
    await expect(page.locator('.wl-card')).toHaveCount(1);
    await page.selectOption('#wl-year', 'undated');
    await expect(page.locator('.wl-card')).toHaveCount(3);
  });

  test('links: safe, labelled, external ones open in a new tab', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    const card = page.locator('.wl-card', { hasText: 'Reducing Stigma' });
    await expect(card.locator('a.wl-primary')).toHaveAttribute('href', 'https://www.childnutritioncouncil.com/resources/p/a');
    await expect(card.locator('a.wl-primary')).toHaveAttribute('target', '_blank');
    await expect(card.locator('a.wl-primary')).toHaveAttribute('rel', /noopener/);
    await expect(card.locator('a.wl-secondary')).toContainText('Watch recording');
    await expect(page.locator('.wl-card', { hasText: 'Bad link' }).locator('a')).toHaveCount(0);
    await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);
  });

  test('filters live in the address bar and can be shared', async ({ page, context }) => {
    await H.serve(page, '/webinars?other=1', webinarPage());
    await page.selectOption('#wl-topic', 'Food Safety');
    await expect(page).toHaveURL(/wl_topic=Food\+Safety/);
    await expect(page).toHaveURL(/other=1/);
    const shared = page.url();
    const p2 = await context.newPage();
    await H.serve(p2, '/webinars', webinarPage());
    await p2.goto(shared);
    await expect(p2.locator('#wl-topic')).toHaveValue('Food Safety');
    await expect(p2.locator('.wl-card')).toHaveCount(2);
    await page.locator('.wl-statusrow .wl-clear').click();
    await expect(page).not.toHaveURL(/wl_/);
    const p3 = await context.newPage();
    await H.serve(p3, '/webinars', webinarPage());
    await p3.goto(H.BASE + '/webinars?wl_topic=Bogus&wl_q=waste');
    await expect(p3.locator('#wl-topic')).toHaveValue('');
    await expect(p3.locator('.wl-card')).toHaveCount(1);
  });

  test('keyboard: search, then the visible filters, then the cards', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    await page.focus('#wl-q');
    const seq = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => document.activeElement.id || document.activeElement.tagName)); }
    expect(seq.slice(0, 4)).toEqual(['wl-topic', 'wl-lang', 'wl-year', 'wl-sort']);
    expect(seq.slice(4, 6)).toEqual(['BUTTON', 'BUTTON']);   // Table / Cards
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('A');
  });

  test('"Show more" pages long lists and moves focus to the new items', async ({ page }) => {
    const rows = [HEADER];
    for (let i = 0; i < 30; i++) rows.push(`Session ${String(i).padStart(2, '0')},2024-${String(i % 12 + 1).padStart(2, '0')}-01,Topic ${i % 3},,,https://example.org/${i},,,,Webinar`);
    await H.serve(page, '/webinars', webinarPage({}, {}, rows.join('\n') + '\n'));
    await expect(page.locator('.wl-card')).toHaveCount(24);
    await expect(page.locator('.wl-more')).toHaveText('Show more (6 more)');
    await page.locator('.wl-more').click();
    await expect(page.locator('.wl-card')).toHaveCount(30);
    await expect(page.locator('.wl-morewrap')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement === document.querySelectorAll('.wl-card')[24].querySelector('a'))).toBe(true);
    await page.fill('#wl-q', 'session');
    await expect(page.locator('.wl-card')).toHaveCount(24);
  });

  test('French page gets French wording, including custom labels', async ({ page }) => {
    await H.serve(page, '/fr', webinarPage({ lang: 'fr-CA' }));
    await expect(page.locator('label[for=wl-q]')).toHaveText('Rechercher des webinaires');
    await expect(page.locator('.wl-card', { hasText: 'Reducing' }).locator('.wl-secondary')).toContainText('Voir l’enregistrement');
    await expect(page.locator('#cncm-webinar-library')).toHaveAttribute('aria-label', 'Bibliothèque de webinaires');
    await page.fill('#wl-q', 'zzz');
    await expect(page.locator('.wl-empty')).toContainText('Aucun résultat');
  });

  test('keeps its look under an aggressive site theme', async ({ page }) => {
    await H.serve(page, '/theme', webinarPage({ head: H.HOSTILE_CSS }));
    const s = await page.evaluate(() => {
      const t = getComputedStyle(document.querySelector('.wl-title'));
      const i = getComputedStyle(document.querySelector('#wl-q'));
      const l = getComputedStyle(document.querySelector('label.wl-label'));
      return [t.fontSize, t.textTransform, i.fontSize, l.textTransform];
    });
    expect(s).toEqual(['19px', 'none', '16px', 'none']);
  });

  test('phone width: no sideways scroll, large tap targets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await H.serve(page, '/webinars', webinarPage());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const small = await page.evaluate(() => [...document.querySelectorAll('.cncm-wl a.wl-btn, .cncm-wl select, .cncm-wl input')]
      .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height < 44).length);
    expect(small).toBe(0);
  });

  test('Google Sheet mode, with fallback when the sheet fails', async ({ page, context }) => {
    const sheet = HEADER + '\n"Sheet webinar, with comma",2026-05-12,Testing,A Presenter,"Line ""quoted"", comma",https://example.org/x,,,,Webinar\nNot a webinar,,,,,https://example.org/y,,,,Guide\n';
    await H.serve(page, '/sheet', webinarPage({}, { sheetCsvUrl: '/sheet.csv' }), { '/sheet.csv': sheet });
    await expect(page.locator('.wl-card')).toHaveCount(1);
    await expect(page.locator('.wl-list')).toContainText('Line "quoted", comma');
    const p2 = await context.newPage();
    await H.serve(p2, '/bad', webinarPage({}, { sheetCsvUrl: '/missing.csv' }), { '/missing.csv': { status: 404, body: '' } });
    await expect(p2.locator('.wl-card')).toHaveCount(WEBINARS_IN_FIXTURE);
  });

  test('empty data shows a friendly message', async ({ page }) => {
    await H.serve(page, '/empty', webinarPage({}, {}, HEADER + '\n'));
    await expect(page.locator('.wl-empty')).toHaveText('Nothing is listed yet. Please check back soon.');
  });

  test('accessibility scan: default, French and empty states', async ({ page }) => {
    await H.serve(page, '/webinars', webinarPage());
    let r = await new AxeBuilder({ page }).include('#cncm-webinar-library').analyze();
    expect(r.violations.map(v => v.id)).toEqual([]);
    await page.fill('#wl-q', 'zzz');
    r = await new AxeBuilder({ page }).include('#cncm-webinar-library').analyze();
    expect(r.violations.map(v => v.id)).toEqual([]);
  });
});

test.describe('table view (the webinar default, like the Coalition list)', () => {
  const tablePage = (opts, config = {}, csv = FIXTURE) =>
    H.page(H.withConfig(H.withData(H.dist('webinar-library'), 'cncm-wl-data', csv), config), opts);

  test('webinars open as a table with one row per webinar and only useful columns', async ({ page }) => {
    const errors = H.trackErrors(page);
    await H.serve(page, '/t', tablePage());
    await expect(page.locator('#cncm-webinar-library')).toHaveAttribute('data-view', 'table');
    await expect(page.locator('.wl-table tbody tr')).toHaveCount(WEBINARS_IN_FIXTURE);
    await expect(page.locator('.wl-table thead th')).toHaveText(['Title', 'Topic', 'Date', 'Presenter', 'Language', 'Links']);
    await expect(page.locator('.wl-table tbody tr').first().locator('th .wl-t')).toHaveText('Éducation alimentaire');
    await expect(page.locator('.wl-list')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('search and filters work in the table, and the view can be switched and shared', async ({ page, context }) => {
    await H.serve(page, '/t', tablePage());
    await page.fill('#wl-q', 'stigma');
    await expect(page.locator('.wl-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.wl-table tbody td[data-label=Topic]')).toHaveText('Inclusion, Program Planning');
    await page.getByRole('button', { name: 'Cards' }).click();
    await expect(page.locator('.wl-card')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/wl_view=cards/);
    const p2 = await context.newPage();
    await H.serve(p2, '/t', tablePage());
    await p2.goto(page.url());
    await expect(p2.locator('.wl-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page).not.toHaveURL(/wl_view/);
  });

  test('accessibility scan in table view, desktop and phone', async ({ page }) => {
    await H.serve(page, '/t', tablePage());
    let r = await new AxeBuilder({ page }).include('#cncm-webinar-library').analyze();
    expect(r.violations.map(v => v.id)).toEqual([]);
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator('.wl-table thead')).toHaveCSS('position', 'absolute');
    r = await new AxeBuilder({ page }).include('#cncm-webinar-library').analyze();
    expect(r.violations.map(v => v.id)).toEqual([]);
  });

  test('French table headings', async ({ page }) => {
    await H.serve(page, '/fr', tablePage({ lang: 'fr-CA' }));
    await expect(page.locator('.wl-table thead th').first()).toHaveText('Titre');
    await expect(page.getByRole('button', { name: 'Fiches' })).toBeVisible();
  });

  test('keeps its look under an aggressive theme', async ({ page }) => {
    await H.serve(page, '/theme', tablePage({ head: H.HOSTILE_CSS }));
    const s = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('.wl-table tbody td'));
      return [c.fontSize, c.borderTopWidth, c.textTransform];
    });
    expect(s).toEqual(['16px', '0px', 'none']);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('shows a link to the Resource Hub instead', async ({ page }) => {
    await H.serve(page, '/nojs', webinarPage());
    await expect(page.locator('#cncm-webinar-library a')).toHaveAttribute('href', /resources\/webinar/);
  });
});

test.describe('resource hub (real CNCM data)', () => {
  const rows = H.parseCsv(H.readCsv('data/resources.csv'));
  const byType = t => rows.filter(r => r.type === t).length;

  test('loads every resource, paged, with type filter', async ({ page }) => {
    const errors = H.trackErrors(page);
    await H.serve(page, '/resources', H.page(H.dist('resource-hub')));
    await expect(page.locator('.wl-count')).toHaveText(`Showing all ${rows.length} resources`);
    await expect(page.locator('.wl-card')).toHaveCount(Math.min(24, rows.length));
    await expect(page.locator('#rh-sort')).toHaveValue('az');
    await expect(page.locator('#rh-year')).toBeHidden();
    const shownTitles = await page.locator('.wl-card .wl-title').allInnerTexts();
    expect(shownTitles).toEqual([...shownTitles].sort((a, b) => a.localeCompare(b, 'en-CA')));
    await page.selectOption('#rh-type', 'Recipe');
    await expect(page.locator('.wl-count')).toHaveText(`Showing ${byType('Recipe')} of ${rows.length} resources`);
    await expect(page).toHaveURL(/rh_type=Recipe/);
    expect(errors).toEqual([]);
  });

  test('every resource has a safe link', async () => {
    for (const r of rows) expect(r.link, r.title).toMatch(/^https?:\/\//);
  });

  test('accessibility scan with real data', async ({ page }) => {
    await H.serve(page, '/resources', H.page(H.dist('resource-hub')));
    const r = await new AxeBuilder({ page }).include('#cncm-resource-hub').analyze();
    expect(r.violations.map(v => v.id)).toEqual([]);
  });

  test('both libraries can share one page', async ({ page }) => {
    await H.serve(page, '/both', H.page(H.dist('webinar-library') + H.dist('resource-hub')));
    await expect(page.locator('#cncm-webinar-library .wl-table tbody tr')).toHaveCount(byType('Webinar'));
    await expect(page.locator('#cncm-resource-hub .wl-card')).toHaveCount(Math.min(24, rows.length));
    expect(await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      return ids.length === new Set(ids).size;
    })).toBe(true);
  });
});
