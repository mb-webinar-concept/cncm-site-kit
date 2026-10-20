# 06 · Review the CommunityBox script

**What we saw:** a script from `dashboard.communitybox.co` (a directory and map tool for Squarespace) loads on every page. We found no visible directory or map using it.

## Question for CNCM first
Is CommunityBox used anywhere, or planned? Is there a paid subscription?

## If it is not used
1. Find where it is added: most likely the site-wide custom code (Code Injection) settings, or a code block on one page.
2. Copy the snippet into a note (so it can be restored), then remove it and **Save**.
3. Cancel the subscription if there is one.

## Why it matters
Every outside script adds loading time and is code CNCM does not control. Removing unused ones is a standard security and speed practice.

## Check
Reload the site logged out; pages look the same. Next Monday's monitor report should no longer list `dashboard.communitybox.co`.
