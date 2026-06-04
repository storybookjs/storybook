import { describe, expect, it } from 'vitest';

import { Tag } from '../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry } from '../../types/modules/indexer.ts';

import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
  selectComponentEntryForComponentId,
} from './select-component-entry.ts';

function makeStoryEntry(id: string, title = 'Comp'): IndexEntry {
  return {
    id,
    name: 'Default',
    title,
    type: 'story',
    subtype: 'story',
    importPath: `./${title.toLowerCase()}.stories.tsx`,
  };
}

describe('selectComponentEntryForComponentId', () => {
  it('returns the story entry when both story and attached docs exist', () => {
    const storyEntry = makeStoryEntry('comp--default', 'Comp');
    const docsEntry = {
      id: 'comp--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './comp.mdx',
      storiesImports: ['./wrong.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    expect(selectComponentEntryForComponentId([docsEntry, storyEntry], 'comp')).toEqual(storyEntry);
  });

  it('returns attached docs when no story entry exists', () => {
    const docsEntry = {
      id: 'comp--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './comp.mdx',
      storiesImports: ['./comp.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    expect(selectComponentEntryForComponentId([docsEntry], 'comp')).toEqual(docsEntry);
    expect(getStoryImportPathFromEntry(docsEntry)).toBe('./comp.stories.tsx');
  });

  it('selectComponentEntriesByComponentId prefers stories over attached docs', () => {
    const storyEntry = makeStoryEntry('comp--default', 'Comp');
    const docsEntry = {
      id: 'comp--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './comp.mdx',
      storiesImports: ['./wrong.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    const map = selectComponentEntriesByComponentId([docsEntry, storyEntry]);
    expect(map.get('comp')).toEqual(storyEntry);
  });
});
