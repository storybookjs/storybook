import { describe, expect, it } from 'vitest';

import {
  describeFacet,
  FACET_TAXONOMY,
  facetMetricKey,
  MISUSE_FACET_IDS,
  MISUSE_FACETS,
  UNCATEGORISED,
} from './facets.ts';

describe('FACET_TAXONOMY', () => {
  it('carries the five droppy-ds categories', () => {
    expect(Object.keys(FACET_TAXONOMY)).toEqual([
      'source-jsdoc',
      'csf-jsdoc',
      'mdx',
      'general',
      'story',
    ]);
    expect(FACET_TAXONOMY.mdx['do-dont']).toBe("Do's and don'ts");
    expect(FACET_TAXONOMY.general['general-tokens']).toBe('Design tokens');
  });
});

describe('MISUSE_FACETS', () => {
  it('is the 12 mdx + 6 general ids, mdx first, in declaration order', () => {
    expect(MISUSE_FACET_IDS).toHaveLength(18);
    expect(MISUSE_FACET_IDS[0]).toBe('mdx.general');
    expect(MISUSE_FACET_IDS[11]).toBe('mdx.styling');
    expect(MISUSE_FACET_IDS[12]).toBe('general.general-a11y');
    expect(MISUSE_FACET_IDS[17]).toBe('general.general-when-to-use');
    expect(MISUSE_FACETS.find((f) => f.id === 'general.general-tokens')?.description).toBe(
      'Design tokens'
    );
  });
});

describe('helpers', () => {
  it('looks up a facet description by qualified id', () => {
    expect(describeFacet('mdx.do-dont')).toBe("Do's and don'ts");
    expect(describeFacet('general.general-tokens')).toBe('Design tokens');
  });

  it('sanitizes ids for dot-path metric keys', () => {
    expect(facetMetricKey('mdx.a11y')).toBe('mdx_a11y');
    expect(facetMetricKey('general.general-when-to-use')).toBe('general_general_when_to_use');
    expect(facetMetricKey(UNCATEGORISED)).toBe('uncategorised');
  });
});
