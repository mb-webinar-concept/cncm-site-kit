# Staff guide

For CNCM staff. No coding needed.

## Put a module on a page (once)

1. In Squarespace, open the page and click **Edit**.
2. **Add Block > Code**.
3. Turn **off** "Display Source".
4. Open the module's file (for example `resource-hub.html`), select everything, copy, and paste it into the block. Save.
5. Check the page in a **private window, logged out**. Squarespace does not run the module while you are logged in, so it may look blank in the editor. That is normal.

## Add or change an item

**Option A: in the block.** Edit the block, find the lines under `DATA`, and add a line. Columns:

`title, date, topic, presenter, description, link, resources, region, language, type`

- Only `title` is required.
- Several topics: separate them with a semicolon, for example `Food Safety; Program Planning`.
- Date: `2026-04-15`, `2026-04` or `2026`, or leave it blank.
- Type: `Webinar`, `Guide` or `Recipe` (the webinar list shows only `Webinar` rows).
- If a value contains a comma, put it in "double quotes".

**Option B: in a Google Sheet (recommended once lists get long).**

1. Put the same columns in a Google Sheet.
2. **File > Share > Publish to web**, choose the sheet and **Comma-separated values (.csv)**, then **Publish**. Copy the link.
3. In the block, find `"sheetCsvUrl": ""` and paste the link between the quotes. Save.
4. From then on, edit the sheet. Changes can take a few minutes to appear. If the sheet ever fails to load, the module shows the list saved in the block instead.

## Change wording or colours

- Wording: in the block, find `"text"` and change the words between quotes.
- Colours: at the top of the `<style>` section, change the values next to `--wl-accent` (libraries) or `--im-accent` (impact).

## Share a filtered view

Filter the list, then copy the address from the browser bar. Anyone who opens it sees the same filters.

## If something looks wrong

1. Check logged out, in a private window.
2. Undo your last edit, or paste the module file again from the latest version.
3. Contact [Contractor organization name] with the page address and what you expected to see.
