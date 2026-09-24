---
name: update-browser-support
description: Recomputes Storybook browser support floors from Plausible /docs usage, writes pinned versions, and opens a PR. Use only when a human explicitly applies this skill.
disable-model-invocation: true
---

# Update browser support

## Auth

Need `PLAUSIBLE_API_KEY` in the environment. How the operator supplies the key is up to them. Do not print the key.

## Query

`POST https://plausible.io/api/v2/query`

- `site_id`: `storybook.js.org`
- `date_range`: `"30d"`
- `filters`: `[["contains", "event:page", ["/docs"]]]`
- `dimensions`: `["visit:browser", "visit:browser_version"]`
- `metrics`: `["visitors", "percentage"]`
- `include`: `{ "total_rows": true }`

Save the request, resolved date range, retrieval time, and complete response. Fetch all pages before rolling versions. Use the same fixed date range for every request in the run.

[Plausible's Stats API reference](https://plausible.io/docs/stats-api#metrics-required) defines `percentage` as the percentage of total visitors in each category. With the query above, the denominator is all unique visitors matching the `/docs` page filter during the selected period, across all browsers and versions. It is not the total for one browser or the sum of the returned version rows. In each result row, `metrics[0]` is `visitors` and `metrics[1]` is `percentage`. Use `metrics[1]` as the share for an unrolled category. The 0.5% cutoff means `percentage >= 0.5`, not `0.005`.

Also query `metrics: ["visitors"]` with no dimensions and the same site, date range, and page filter to record the denominator. Do not add browser filters to this denominator query.

## Heuristic

1. Roll Chrome / Edge / Firefox / Opera to **major**. Roll Safari to **major.minor**.
2. Share is visitors / total `/docs` visitors × 100. For a rolled version containing multiple raw versions, query `metrics: ["visitors"]` with no dimensions, the same site/date/page filter, and additional `is` filters for that browser and its matching raw versions. Divide this unique-visitor count by the recorded denominator and multiply by 100 to get the rolled share. Do not sum unique-visitor counts or percentages across raw versions; a visitor can appear in more than one row.
3. Drop any rolled version under **0.5%**.
4. Floor = oldest version in the **current cluster**, not an isolated older island that itself clears 0.5%.
5. Omit Opera unless one Opera version is ≥ 0.5%. Drop UC Browser.

Companions: `android` / `and_chr` = Chrome floor. `ios_saf` = Safari floor. Leave Node unchanged.

## Approve the selection

The heuristic does not define a numerical boundary between the current cluster and an older island. Do not infer that boundary silently or write new floors without explicit operator approval.

Present the saved query evidence and a table for each browser containing:

- All rolled versions and their shares, including versions below the cutoff.
- The exact versions proposed as the current cluster and any excluded older islands.
- The candidate floor and its share of all `/docs` visitors.
- The rationale for the cluster boundary and for including or omitting Opera.

Record the operator's approval, identity, date, and selected versions with the evidence in the PR. The floor is the oldest qualifying version in that approved cluster. If the operator disputes the boundary or the evidence cannot distinguish clusters, stop and ask the Technical Architect to resolve the selection semantics. Do not change the policy to break a tie. Reuse of the saved evidence and approval must yield the same floors.

## Write

Pin explicit versions (do not leave a live query):

- `code/core/src/shared/constants/environments-support.ts` — `BROWSER_TARGETS` (`chromeN`, `edgeN`, `firefoxN`, `safariN.N`, `iosN.N`; Opera only if kept)
- `code/package.json` — `browserslist`
- `docs/get-started/install.mdx` — public list and older-browser fallback guidance, scoped to the same Storybook versions as `MIGRATION.md`; preserve the preview-only limitations
- `MIGRATION.md` — next major `From version X.x to Y.0.0` section. Create that section at the top if it does not exist.

If browserslist cannot resolve the new pins, bump `caniuse-lite` (root `resolutions` + lockfile). The repo has a 7-day npm age gate.

## PR

Branch from `origin/next`. Open a PR that targets `next` and follows `.github/PULL_REQUEST_TEMPLATE.md`. Add labels `ci:normal`, `qa:skip`, and `BREAKING CHANGE`.

In **What I did**, keep it short: before → after versions, and the share of `/docs` visitors for each chosen floor.
