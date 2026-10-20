# Changelog

## 1.1.1 — 2026-10-20

- Change tickets in changes/ for the six engineering-review items on CNCM's Squarespace site, approved by Jess Sutherland; each still needs CNCM's approval and access.
- Removed Python cache files committed by mistake; they are now ignored.

## 1.1.0 — 2026-10-20

- Site monitor: weekly passive check of public pages (errors, broken links, HTTPS and protective headers, insecure content, new script sources, spelling, dated statistics, alt text), posted as a GitHub issue. 5 unit tests against a local fixture site.
- Optional AI reviewer: comments on the weekly report with grammar, clarity and outdated-wording findings.
- Webmaster agent: on an @claude request from someone with write access, makes the change on a branch, runs all tests and opens a pull request; Squarespace changes become change tickets. Rules in CLAUDE.md.
- One-step Windows publish script.

## 1.0.0 — 2026-10-19

- Library module: search (accent-insensitive), filters for type, topic, region, language, year and past/upcoming, sorting, "Show more" paging, shareable filtered links, English and French wording, Google Sheet mode with fallback, several topics per item.
- Instances: webinar library (webinars only) and resource library (all 128 Resource Hub items), both built from one data file.
- Impact module: headline numbers with sources, schools supported by region, searchable division table.
- Resource Hub import from Squarespace, with manual overrides (Food Waste Prevention: presenter and April 2023 date).
- Build script, sandbox pages, 36 Playwright tests with axe scans, GitHub Actions for tests and the sandbox site.
