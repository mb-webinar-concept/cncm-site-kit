# 05 · Fix the Food Waste Prevention page address

**Page today:** https://www.childnutritioncouncil.com/resources/p/more-than-a-meal-unlocking-food-literacy-in-school-settings-swl62
**Why:** the address was copied from the "More Than a Meal" webinar, which makes the two look like the same item and hurts search.

## Steps
1. Open the Resource Hub store page in the editor, find **Webinar - Food Waste Prevention**, open its settings, and change the URL slug to `webinar-food-waste-prevention`. Save.
2. Add a redirect so old links keep working, in Squarespace's URL Mappings:
   `/resources/p/more-than-a-meal-unlocking-food-literacy-in-school-settings-swl62 -> /resources/p/webinar-food-waste-prevention 301`
3. Tell us when done: we update `data/overrides.csv` and `data/source/` and rebuild, so the libraries link to the new address.

## Check
Both the old and new addresses open the Food Waste Prevention page.
