// Smoke test: every generated sandbox page loads without script errors.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const H = require('./helpers');

const dir = path.join(H.ROOT, 'sandbox');
const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const f of pages) {
  test(`sandbox page loads cleanly: ${f}`, async ({ page }) => {
    const errors = H.trackErrors(page);
    await H.serve(page, '/' + f, fs.readFileSync(path.join(dir, f), 'utf8'));
    await expect(page.locator('[data-ready="1"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
