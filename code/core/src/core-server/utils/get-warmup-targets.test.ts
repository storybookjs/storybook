import { describe, expect, it } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../types/index.ts';
import { getWarmupTargets } from './get-warmup-targets.ts';

const index = (...entries: IndexEntry[]): StoryIndex => ({
  v: 5,
  entries: Object.fromEntries(entries.map((e) => [e.id, e])),
});

const story = (id: string, importPath: string, tags: string[] = ['dev']): IndexEntry => ({
  type: 'story',
  subtype: 'story',
  id,
  name: id,
  title: id,
  importPath,
  tags,
});

const docs = (
  id: string,
  importPath: string,
  storiesImports: string[],
  tags: string[]
): IndexEntry => ({
  type: 'docs',
  id,
  name: id,
  title: id,
  importPath,
  storiesImports,
  tags,
});

describe('getWarmupTargets', () => {
  it('returns undefined for an empty index', () => {
    expect(getWarmupTargets(index())).toBeUndefined();
  });

  it('warms the first story file when the first entry is a story', () => {
    const result = getWarmupTargets(index(story('a--default', './A.stories.tsx')));
    expect(result).toEqual({ importPaths: ['./A.stories.tsx'] });
  });

  it('preserves index (storySort) order when choosing the first entry', () => {
    const result = getWarmupTargets(
      index(story('a--default', './A.stories.tsx'), story('b--default', './B.stories.tsx'))
    );
    expect(result).toEqual({ importPaths: ['./A.stories.tsx'] });
  });

  it('includes referenced CSF files for an MDX docs entry', () => {
    const result = getWarmupTargets(
      index(docs('page--docs', './Page.mdx', ['./A.stories.tsx'], ['dev', 'unattached-mdx']))
    );
    expect(result).toEqual({ importPaths: ['./Page.mdx', './A.stories.tsx'] });
  });

  it('warms a CSF autodocs entry (no dev tag required, no extra imports)', () => {
    const result = getWarmupTargets(index(docs('a--docs', './A.stories.tsx', [], ['autodocs'])));
    expect(result).toEqual({ importPaths: ['./A.stories.tsx'] });
  });

  it('warms both the raw-first and the first sidebar-visible entry when they differ', () => {
    // The raw first entry is what the preview renders for `id=*`; the first `dev` entry is what the
    // manager navigates to. When they differ (first entry is `!dev`), warm both.
    const result = getWarmupTargets(
      index(
        story('hidden--default', './Hidden.stories.tsx', ['test']),
        story('shown--default', './Shown.stories.tsx', ['dev'])
      )
    );
    expect(result).toEqual({
      importPaths: ['./Hidden.stories.tsx', './Shown.stories.tsx'],
    });
  });

  it('deduplicates overlapping import paths', () => {
    const result = getWarmupTargets(
      index(
        docs('page--docs', './Page.mdx', ['./A.stories.tsx'], ['test', 'unattached-mdx']),
        story('a--default', './A.stories.tsx', ['dev'])
      )
    );
    expect(result).toEqual({ importPaths: ['./Page.mdx', './A.stories.tsx'] });
  });
});
