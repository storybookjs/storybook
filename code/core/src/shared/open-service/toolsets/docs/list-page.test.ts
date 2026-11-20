import { describe, expect, it } from 'vitest';

import { estimateTokens } from '../estimate-tokens.ts';
import { pageListing, readListRequest, type ListingPage, type ListQuery } from './list-page.ts';
import {
  formatManifestsToLists,
  formatMultiSourceManifestsToLists,
} from './manifest-formatter/markdown.ts';
import type { AllManifests } from './manifest-formatter/manifest-types.ts';
import type { SourceListing } from './sources.ts';

function manifests(
  components: string[],
  docs: string[] = [],
  summary = 'A component'
): AllManifests {
  return {
    componentManifest: {
      v: 1,
      components: Object.fromEntries(
        components.map((id) => [id, { id, name: `Name ${id}`, summary }])
      ),
    },
    ...(docs.length > 0
      ? {
          docsManifest: {
            v: 1,
            docs: Object.fromEntries(docs.map((id) => [id, { id, name: `Doc ${id}`, summary }])),
          },
        }
      : {}),
  } as AllManifests;
}

function source(id: string, listing: Omit<SourceListing, 'source'>): SourceListing {
  return { source: { id, title: `Source ${id}`, url: `https://${id}.example.com` }, ...listing };
}

const range = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

function rowsOf(sections: { manifests?: AllManifests; source?: { id: string } }[]): string[] {
  return sections.flatMap((section) => {
    const prefix = section.source ? `${section.source.id}/` : '';
    const rows = [
      ...Object.keys(section.manifests?.componentManifest.components ?? {}).map(
        (id) => `${prefix}c:${id}`
      ),
      ...Object.keys(section.manifests?.docsManifest?.docs ?? {}).map((id) => `${prefix}d:${id}`),
    ];
    return rows.length > 0 ? rows : [`${prefix}!`];
  });
}

const renderComposed = (page: ListingPage<SourceListing>) =>
  formatMultiSourceManifestsToLists(page.sections);
const keyOfSource = (section: SourceListing) => section.source.id;

function walk<TSection extends { manifests?: AllManifests }>(
  sections: TSection[],
  options: {
    keyOf: (section: TSection) => string | undefined;
    render: (page: ListingPage<TSection>) => string;
    tokenBudget: number;
    query?: ListQuery;
  }
) {
  const pages = [];
  let cursor: string | undefined;
  do {
    const parsed = readListRequest({ ...(options.query ?? { withStoryIds: false }), cursor });
    if (!parsed.ok) {
      throw new Error(parsed.refusal);
    }
    const paged = pageListing(sections, { ...options, request: parsed.request });
    if (!paged.ok) {
      throw new Error(paged.refusal);
    }
    pages.push(paged);
    cursor = paged.page.nextCursor;
  } while (cursor !== undefined);
  return pages;
}

const composition = [
  source('a', { manifests: manifests(range('a', 30), range('guide', 5)) }),
  source('b', { error: 'Failed to get component manifest: 503' }),
  source('c', { manifests: manifests([]) }),
  source('d', { manifests: manifests(range('d', 40)) }),
];

describe('pageListing', () => {
  it('visits every row of a composition once, in order, each page within the budget', () => {
    const pages = walk(composition, {
      keyOf: keyOfSource,
      render: renderComposed,
      tokenBudget: 200,
    });

    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flatMap(({ page }) => rowsOf(page.sections))).toEqual(rowsOf(composition));
    for (const { page, markdown, tokenCount } of pages) {
      expect(markdown).toBe(renderComposed(page));
      expect(tokenCount).toBe(estimateTokens(markdown));
      expect(tokenCount <= 200 || rowsOf(page.sections).length === 1).toBe(true);
    }
    expect(pages.slice(0, -1).every(({ page }) => !!page.nextCursor)).toBe(true);
    expect(pages.at(-1)!.page).not.toHaveProperty('nextCursor');
  });

  it('visits every row of a single Storybook once, in order', () => {
    const single = [{ manifests: manifests(range('item', 50), range('guide', 10)) }];
    const render = (page: ListingPage<{ manifests: AllManifests }>) =>
      formatManifestsToLists(page.sections[0].manifests);

    const pages = walk(single, { keyOf: () => undefined, render, tokenBudget: 150 });

    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flatMap(({ page }) => rowsOf(page.sections))).toEqual(rowsOf(single));
    for (const { page, tokenCount } of pages) {
      expect(tokenCount <= 150 || rowsOf(page.sections).length === 1).toBe(true);
    }
  });

  it('ships a row that alone exceeds the budget as a page of its own', () => {
    const huge = 'word '.repeat(500).trim();
    const sections = [
      source('a', {
        manifests: {
          componentManifest: {
            v: 1,
            components: {
              first: { id: 'first', name: 'First', summary: 'Small' },
              huge: { id: 'huge', name: 'Huge', summary: huge },
              last: { id: 'last', name: 'Last', summary: 'Small' },
            },
          },
        } as AllManifests,
      }),
    ];

    const pages = walk(sections, { keyOf: keyOfSource, render: renderComposed, tokenBudget: 100 });

    expect(pages.map(({ page }) => rowsOf(page.sections))).toEqual([
      ['a/c:first'],
      ['a/c:huge'],
      ['a/c:last'],
    ]);
    expect(pages[1].tokenCount).toBeGreaterThan(100);
  });

  it('returns a listing that fits as the very same sections and text', () => {
    const parsed = readListRequest({ withStoryIds: false });
    expect(parsed.ok).toBe(true);

    const paged = pageListing(composition, {
      request: (parsed as Extract<typeof parsed, { ok: true }>).request,
      keyOf: keyOfSource,
      render: renderComposed,
      tokenBudget: 20_000,
    });

    expect(paged.ok).toBe(true);
    const { page, markdown } = paged as Extract<typeof paged, { ok: true }>;
    expect(page).not.toHaveProperty('nextCursor');
    expect(page.sections).toHaveLength(composition.length);
    page.sections.forEach((section, index) => expect(section).toBe(composition[index]));
    expect(markdown).toBe(formatMultiSourceManifestsToLists(composition));
  });

  it('keeps the listing order of numeric-looking ids across pages', () => {
    const sections = [source('a', { manifests: manifests(['b', '10', 'a', '2', '1', 'z']) })];

    const pages = walk(sections, { keyOf: keyOfSource, render: renderComposed, tokenBudget: 30 });

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(({ page }) => rowsOf(page.sections))).toEqual(
      ['1', '2', '10', 'b', 'a', 'z'].map((id) => `a/c:${id}`)
    );
  });
});

describe('cursors', () => {
  function firstPage(sections: SourceListing[], query: ListQuery = { withStoryIds: false }) {
    const parsed = readListRequest(query);
    if (!parsed.ok) {
      throw new Error(parsed.refusal);
    }
    const paged = pageListing(sections, {
      request: parsed.request,
      keyOf: keyOfSource,
      render: renderComposed,
      tokenBudget: 100,
    });
    if (!paged.ok || !paged.page.nextCursor) {
      throw new Error('expected a first page with a next cursor');
    }
    return { cursor: paged.page.nextCursor, rows: rowsOf(paged.page.sections) };
  }

  function resume(sections: SourceListing[], cursor: string) {
    const parsed = readListRequest({ withStoryIds: false, cursor });
    if (!parsed.ok) {
      throw new Error(parsed.refusal);
    }
    return pageListing(sections, {
      request: parsed.request,
      keyOf: keyOfSource,
      render: renderComposed,
      tokenBudget: 100,
    });
  }

  it('carries the inputs of the first call, so the cursor alone continues that listing', () => {
    const { cursor } = firstPage(composition, { withStoryIds: true, storybookIds: ['a', 'd'] });

    const parsed = readListRequest({ withStoryIds: false, cursor });

    expect(parsed.ok).toBe(true);
    expect((parsed as Extract<typeof parsed, { ok: true }>).request.query).toEqual({
      withStoryIds: true,
      storybookIds: ['a', 'd'],
    });
  });

  it('refuses a cursor it did not issue', () => {
    const { cursor } = firstPage(composition);

    for (const unreadable of [
      'not-a-cursor',
      '',
      btoa(JSON.stringify({ v: 2, o: 0, d: '0' })),
      cursor.slice(0, -6),
    ]) {
      expect(readListRequest({ withStoryIds: false, cursor: unreadable })).toEqual({
        ok: false,
        refusal: 'cursor-unreadable',
      });
    }
  });

  it('refuses a cursor next to inputs that ask for another listing', () => {
    const { cursor } = firstPage(composition, { withStoryIds: false, storybookIds: ['a', 'd'] });

    expect(readListRequest({ withStoryIds: false, storybookIds: ['d'], cursor })).toEqual({
      ok: false,
      refusal: 'cursor-conflict',
    });
    expect(readListRequest({ withStoryIds: true, cursor })).toEqual({
      ok: false,
      refusal: 'cursor-conflict',
    });
    expect(readListRequest({ withStoryIds: false, storybookIds: ['d', 'a'], cursor }).ok).toBe(
      true
    );
  });

  it('refuses a cursor once a row it already delivered is gone', () => {
    const { cursor, rows } = firstPage(composition);
    expect(rows.at(-1)).toMatch(/^a\/c:/);

    const withoutFirst = [
      source('a', { manifests: manifests(range('a', 30).slice(1), range('guide', 5)) }),
      ...composition.slice(1),
    ];

    expect(resume(withoutFirst, cursor)).toEqual({ ok: false, refusal: 'cursor-stale' });
    expect(resume(composition.slice(1), cursor)).toEqual({ ok: false, refusal: 'cursor-stale' });
  });

  it('continues past changes after the cursor and in other sources', () => {
    const { cursor, rows } = firstPage(composition);

    const changed = [
      source('a', { manifests: manifests([...range('a', 30), 'a-new'], range('guide', 5)) }),
      source('b', { manifests: manifests(['b-recovered']) }),
      ...composition.slice(2),
    ];
    const next = resume(changed, cursor);

    expect(next.ok).toBe(true);
    const nextRows = rowsOf((next as Extract<typeof next, { ok: true }>).page.sections);
    expect(nextRows[0]).toBe(`a/c:a-${rows.length}`);
  });
});
