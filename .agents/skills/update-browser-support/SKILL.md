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
- `metrics`: `["visitors"]`

## Heuristic

1. Roll Chrome / Edge / Firefox / Opera to **major**. Roll Safari to **major.minor**.
2. Share is visitors / total `/docs` visitors.
3. Drop any rolled version under **0.5%**.
4. Floor = oldest version in the **current cluster**, not an isolated older island that itself clears 0.5%.
5. Omit Opera unless one Opera version is ≥ 0.5%. Drop UC Browser.

Companions: `android` / `and_chr` = Chrome floor. `ios_saf` = Safari floor. Leave Node unchanged.

## Write

Pin explicit versions (do not leave a live query):

- `code/core/src/shared/constants/environments-support.ts` — `BROWSER_TARGETS` (`chromeN`, `edgeN`, `firefoxN`, `safariN.N`, `iosN.N`; Opera only if kept)
- `code/package.json` — `browserslist`
- `docs/get-started/install.mdx` — public list

If browserslist cannot resolve the new pins, bump `caniuse-lite` (root `resolutions` + lockfile). The repo has a 7-day npm age gate.

## PR

Branch from `origin/next`. Open a PR that targets `next` and follows `.github/PULL_REQUEST_TEMPLATE.md`. Add labels `ci:normal`, `qa:skip`, and `BREAKING CHANGE`.

In **What I did**, keep it short: before → after versions, and the share of `/docs` visitors for each chosen floor.
