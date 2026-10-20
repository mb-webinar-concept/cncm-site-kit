# 03 · Install the resource library

**File:** `dist/resource-hub.html` (about 60 KB; all 128 Resource Hub items)
**Needs:** Squarespace Core plan or higher.

## Steps
1. **Pages > +** add a blank page named **Resource library** in *Not linked*. Address: `/resource-library`.
2. **Add Block > Code**, "Display Source" **off**, paste the whole file, **Save**.
3. If Squarespace refuses the paste because it is too long, switch to Google Sheet mode: put `data/resources.csv` into a Google Sheet, **File > Share > Publish to web > CSV**, paste that link into `"sheetCsvUrl": ""` in the block, and delete the data lines (keep the header line).
4. Check logged out, in a private window.
5. When approved, link it from the Resource Hub page ("Search all resources") and the menu. The existing resource pages stay, so no current link breaks.

## Check
"Showing all 128 resources"; the Type filter shows Guide, Recipe and Webinar; "Open resource" opens the file; "Details" opens CNCM's page.
