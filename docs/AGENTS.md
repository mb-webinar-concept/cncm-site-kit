# Site agents: overseer and webmaster

Two agents look after the website from outside it. Neither lives on the site, and nothing changes without a person approving it twice: once by asking, once by merging.

## How it works

1. **Monday morning, automatically: the monitor** (`.github/workflows/site-monitor.yml`). A plain script, no AI. It reads every public page of each enabled site and opens a GitHub issue, "Site health report", sorted into **Action needed**, **Worth a look** and **FYI**. Last week's report is closed. GitHub emails the repository owner.
   - Pages: errors, slow pages.
   - Links: broken links, inside and outside the site.
   - Security, passive only: HTTPS, protective headers, insecure (`http://`) content or forms, scripts loading from new outside sources, links opening new tabs unprotected.
   - Content: spelling, statistics citing old years, images without alt text, missing titles and descriptions, email addresses exposed to spam harvesters.
2. **Right after: the AI reviewer, optional** (`.github/workflows/site-review-ai.yml`). Claude reads the report and up to 15 pages, then adds one comment covering grammar, unclear or outdated wording, and anything a webmaster should know. It changes nothing.
3. **A person decides.** Comment on the issue, for example: `@claude please fix the three spelling items and the broken link on the Grants page.` Only people with write access to the repository can trigger the agent.
4. **The webmaster agent** (`.github/workflows/webmaster.yml`) makes the change on a branch, rebuilds, runs every test, and opens a pull request. Rules: `CLAUDE.md`.
   - Code and data (modules, resource lists, wording): the pull request holds the change itself.
   - Squarespace pages (text, menus, settings): Squarespace has no API for page content, so the agent writes a **change ticket** with the page, the exact old and new text, and click-by-click steps.
5. **A person approves.** Review the pull request and merge it. For a change ticket, a staff member applies it in Squarespace and checks the page logged out.

## Setup (once, about 15 minutes)

1. **Turn on the monitor for CNCM's site only with CNCM's written agreement.** Until then it checks only our test site. To enable it, set `"enabled": true` for the CNCM entry in `monitor/config.json`.
2. **Protect `main`.** In GitHub, go to Settings, Branches, add a rule for `main`, and require a pull request and the Test workflow to pass. Even an agent then cannot change `main` directly.
3. **For the two AI parts:**
   - Install the [Claude GitHub App](https://github.com/apps/claude) on this repository.
   - In Settings, Secrets and variables, Actions, add **one** secret: `ANTHROPIC_API_KEY` (from the Claude Console, billed per use), or `CLAUDE_CODE_OAUTH_TOKEN` (uses a Pro, Max, Team or Enterprise subscription; create it with `claude setup-token`).
   - Without a secret, the monitor still runs and the AI parts skip themselves.
4. **Test it.** Actions, Site monitor, Run workflow. A report issue should appear within a few minutes.

## Limits to know

- GitHub pauses scheduled workflows in public repositories after 60 days with no activity. Any commit restarts them.
- The monitor reads pages as delivered, before scripts run. Content that only appears after JavaScript runs, such as the library cards, is covered by the browser tests instead.
- Security checks are surface checks of what any visitor can see. Squarespace manages the servers; findings there are questions to raise with Squarespace, not things we can fix.
- AI reviewers can be wrong. That is why the webmaster agent only proposes, and a person merges.
- Costs: the monitor and tests use free GitHub Actions minutes on a public repository. The AI parts use Claude API credit or the subscription behind the token; each run is capped (`--max-turns`).

Sources: [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) · [Squarespace APIs](https://developers.squarespace.com/commerce-api) · [codespell](https://github.com/codespell-project/codespell)
