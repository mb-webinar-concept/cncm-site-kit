# 04 · Add the impact panel to Local Impact

**Page:** https://www.childnutritioncouncil.com/local-impact, "Program Locations" section
**File:** `dist/impact.html`

## Before applying
The regional totals on the page add up to 421 schools; the 2025–26 annual report counts 443 programs. CNCM confirms which figure each list should show and the date it applies to. Corrections go in `data/divisions.csv` and `data/impact-stats.csv`; we rebuild the file.

## Steps
1. Edit **Local Impact**. In "Program Locations", add **Add Block > Code** under the regional map, "Display Source" **off**, paste the whole file, **Save**.
2. Check logged out. When approved, remove the long text lists by division (the panel replaces them with a searchable table). Keep the regional map image if staff like it.

## Check
Four headline numbers with sources; five region bars; clicking a region filters the table; searching "Seven Oaks" finds that division.
