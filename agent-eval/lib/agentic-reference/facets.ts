// The documentation facet taxonomy the eval pipeline judges and reports
// against. Baseline vocabulary: droppy-ds classification-labels.jsonc at the
// pinned sha dfe7e43eeb2ff25c95897e55e86a976ef3f7cb7d. Descriptions travel to
// report tooltips, so keep them one short line each. base-ui's divergent
// leaves (mdx.testing, story.base, story.infra) live on its side, not here.
export const FACET_TAXONOMY = {
  // JSDoc in the component sources under src/components
  'source-jsdoc': {
    component: 'Description of the component function',
    props: 'Description of properties in the API / TS type',
  },
  // JSDoc in the CSF files
  'csf-jsdoc': {
    meta: 'Description of the CSF meta / component',
    story: 'Description of the story function',
  },
  // Facet blocks inside a component's MDX, delimited by {/* BEGIN: x */} … {/* END: x */}
  mdx: {
    general: 'General component information',
    behavior: 'Explanation of component behaviour',
    examples: 'Real-world usage examples',
    'do-dont': "Do's and don'ts",
    'when-to-use': 'When to use and not to use, alternatives',
    anatomy: 'The component anatomy',
    history: 'Decision history on the component',
    'known-issues': 'Known issues and open questions about the component',
    a11y: 'A11y rules to follow',
    brand: 'Rules specific to the Droppy brand',
    props: 'API reference / props section (MDX)',
    styling: 'Styling hooks and token guidelines (MDX)',
  },
  // Repo-wide MDX in src/docs, matched whole-file by their <Meta tags={[...]} />
  general: {
    'general-a11y': 'General accessibility guidelines',
    'general-tokens': 'Design tokens',
    'general-setup': 'Setup guide',
    'general-brand': 'Brand principles',
    'general-do-dont': 'General usage guidelines',
    'general-when-to-use': 'General component selection guidelines',
  },
  // Story tags
  story: {
    'api-ref': 'Stories for individual component props',
    showcase: 'One primary example showing the most relevant use case, with realistic data',
    highlight: 'Stories that clarify a specific point made in the documentation',
    examples: 'Real-world combinations of components extracted from products using Droppy',
    tests: 'Play-function stories for specific behaviors',
    animation: 'Stories demonstrating the transition/animation contract',
    anatomy: 'Annotated story for the anatomy component',
  },
} as const;

export type FacetCategory = keyof typeof FACET_TAXONOMY;

/** Qualified `category.leaf` id, e.g. `mdx.do-dont`. */
export type FacetId = {
  [C in FacetCategory]: `${C}.${keyof (typeof FACET_TAXONOMY)[C] & string}`;
}[FacetCategory];

export function describeFacet(id: FacetId): string {
  const dot = id.indexOf('.');
  return (FACET_TAXONOMY as Record<string, Record<string, string>>)[id.slice(0, dot)]![
    id.slice(dot + 1)
  ]!;
}

const MISUSE_CATEGORIES: readonly FacetCategory[] = ['mdx', 'general'];

/** The facets the DS misuse judge categorizes against: all mdx.* and general.* ids. */
export const MISUSE_FACETS: readonly { id: FacetId; description: string }[] =
  MISUSE_CATEGORIES.flatMap((category) =>
    Object.entries(FACET_TAXONOMY[category]).map(([leaf, description]) => ({
      id: `${category}.${leaf}` as FacetId,
      description,
    }))
  );

export const MISUSE_FACET_IDS: readonly FacetId[] = MISUSE_FACETS.map((facet) => facet.id);

/**
 * Bucket id for judgements whose reason cites no facet. Never a valid judge
 * output — the judge omits `facet` instead; this id exists for chart, filter,
 * and metric keys downstream.
 */
export const UNCATEGORISED = 'uncategorised';

/**
 * Facet id sanitized for use as a dot-path segment and CSV/registry key:
 * `mdx.a11y` → `mdx_a11y`. Dots would split the segment in metricValueAt;
 * hyphens are replaced too so keys read as one identifier style.
 */
export function facetMetricKey(id: string): string {
  return id.replace(/[.-]/g, '_');
}
