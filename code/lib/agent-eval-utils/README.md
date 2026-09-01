# @storybook/agent-eval-utils

The documentation facet taxonomy shared by the Storybook agent-eval pipeline
and design-system repos' `experiment:freeze` tooling. Zero runtime
dependencies.

## What's in here

A facet is a labeled section of component documentation — a JSDoc block, an
MDX `{/* BEGIN: x */}…{/* END: x */}` region, or a story tag. The taxonomy
gives every facet a qualified id (`category.leaf`, e.g. `mdx.do-dont`) and a
short description, so the eval pipeline's DS-misuse judge can cite which part
of the docs a decision was (or should have been) grounded in, and so per-repo
tooling can extend the vocabulary without forking it.

### Main exports

- `FACET_TAXONOMY` — the baseline taxonomy: `source-jsdoc`, `csf-jsdoc`,
  `mdx`, `general`, and `story` categories, each leaf mapped to a one-line
  description.
- `FacetId` — the union of every qualified `category.leaf` id in the
  taxonomy.
- `MISUSE_FACETS` / `MISUSE_FACET_IDS` — the `mdx.*` + `general.*` ids (with
  descriptions) the DS-misuse judge categorizes its decisions against.
- `UNCATEGORISED` — sentinel id (`'uncategorised'`) for judgements whose
  reason cites no facet. Never a valid judge output; the judge omits `facet`
  instead.
- `qualify(category, leaf)` — joins a category and leaf into a qualified id.
- `parseFacetId(id)` / `isFacetId(value)` — split a qualified id back into
  `{ category, leaf }`, or validate one against the taxonomy.
- `describeFacet(id)` — the tooltip-ready description for a `FacetId`.
- `extendTaxonomy(base, extra)` — merges per-repo additions onto a taxonomy
  (e.g. base-ui's divergent leaves `mdx.testing`, `story.base`,
  `story.infra`) without mutating `base`.
- `facetMetricKey(id)` — sanitizes an id for use as a dot-path segment and
  CSV/registry key: `mdx.a11y` → `mdx_a11y`.

### Usage

```ts
import { describeFacet, isFacetId, qualify } from '@storybook/agent-eval-utils';

const id = qualify('mdx', 'do-dont'); // 'mdx.do-dont'
isFacetId(id); // true
describeFacet(id); // "Do's and don'ts"
```

## Provenance

The baseline vocabulary is transcribed from droppy-ds's
`classification-labels.jsonc` at the pinned sha
`yannbf/droppy-ds@dfe7e43eeb2ff25c95897e55e86a976ef3f7cb7d`. Descriptions are
kept to one short line each because they travel to report tooltips.
`agent-eval` consumes this package via `workspace:*`; design-system repos
install it from npm to drive their own `experiment:freeze` tooling.
