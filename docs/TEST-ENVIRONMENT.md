# Test environment

Three layers, from fastest to most realistic. A change moves to the next layer only when the previous one passes.

## 1. Automated tests (every change, about 1 minute)

- `npm test` locally, and automatically on GitHub for every push and pull request (`.github/workflows/test.yml`).
- 36 browser tests: search, filters, sorting, paging, shareable links, French wording, Google Sheet mode and its fallback, JavaScript turned off, keyboard order, phone width, an aggressive theme, and axe accessibility scans.
- The pages are served through Playwright's network routing, so no server or internet is needed.

## 2. Sandbox site (for people to click through)

- `npm run sandbox` locally, or the GitHub Pages site published after tests pass on `main` (`.github/workflows/sandbox.yml`).
- Each module appears on a plain page, a French page and a page with an aggressive theme.
- GitHub Pages is free for public repositories; private repositories need a paid GitHub plan. The sandbox holds only content CNCM already publishes.

## 3. Squarespace staging (real platform, before CNCM's site)

- Create a separate Squarespace trial site. Trials last 14 days, with a one-time 7-day extension on request; protect it with a site password and invite reviewers as contributors.
- First check: does a Code Block run the module during the trial? We could not confirm this from published sources. If not, use a hidden, unlinked page on CNCM's own site instead.
- Paste each `dist/` file, view logged out, and run through the acceptance tests in the build plan.

## 4. CNCM's site, hidden page (final check)

- Add the module to a page that is not in the navigation, check it logged out, get staff sign-off, then link it.

## Is GitHub appropriate?

Yes, for the code: version history, automatic tests on every change, a shareable sandbox, and a clean handover (a repository can be transferred to CNCM later). It is not where CNCM staff edit content; they use Squarespace and a Google Sheet.

Recommended setup: a GitHub organization for the contracting business, one repository per client, `main` protected so changes arrive by pull request with passing tests.
