import { describe, expect, it } from 'vitest';

import {
  extendTaxonomy,
  FACET_TAXONOMY,
  facetMetricKey,
  isFacetId,
  MISUSE_FACET_IDS,
  MISUSE_FACETS,
  parseFacetId,
  qualify,
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
  it('validates and parses qualified ids', () => {
    expect(isFacetId('mdx.a11y')).toBe(true);
    expect(isFacetId('mdx.nope')).toBe(false);
    expect(isFacetId('a11y')).toBe(false);
    expect(parseFacetId('general.general-brand')).toEqual({
      category: 'general',
      leaf: 'general-brand',
    });
    expect(parseFacetId('junk')).toBeNull();
  });

  it('joins a category and leaf into a qualified id', () => {
    expect(qualify('mdx', 'do-dont')).toBe('mdx.do-dont');
    expect(qualify('general', 'general-tokens')).toBe('general.general-tokens');
  });

  it('sanitizes ids for dot-path metric keys', () => {
    expect(facetMetricKey('mdx.a11y')).toBe('mdx_a11y');
    expect(facetMetricKey('general.general-when-to-use')).toBe('general_general_when_to_use');
    expect(facetMetricKey(UNCATEGORISED)).toBe('uncategorised');
  });

  it('extends a taxonomy without mutating the base', () => {
    const merged = extendTaxonomy(FACET_TAXONOMY, {
      mdx: { testing: 'Testing guidance' },
      story: { base: 'Base story' },
    });
    expect(merged.mdx!.testing).toBe('Testing guidance');
    expect(merged.mdx!['do-dont']).toBe("Do's and don'ts");
    expect(merged.story!.base).toBe('Base story');
    expect((FACET_TAXONOMY.mdx as Record<string, string>).testing).toBeUndefined();
  });
});
