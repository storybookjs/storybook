import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';

import { Tag } from '../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry } from '../../types/modules/indexer.ts';

import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from './select-component-entry.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(once.warn).mockImplementation(() => undefined);
});

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

describe('selectComponentEntriesByComponentId', () => {
  it('prefers stories over attached docs for the same componentId', () => {
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

  it('falls back to attached docs when no story entry exists', () => {
    const docsEntry = {
      id: 'comp--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './comp.mdx',
      storiesImports: ['./comp.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    const map = selectComponentEntriesByComponentId([docsEntry]);
    expect(map.get('comp')).toEqual(docsEntry);
    expect(getStoryImportPathFromEntry(docsEntry)).toBe('./comp.stories.tsx');
  });

  it('last story entry wins when multiple files share a componentId', () => {
    const first = { ...makeStoryEntry('comp--a', 'Comp'), importPath: './comp-a.stories.tsx' };
    const second = { ...makeStoryEntry('comp--b', 'Comp'), importPath: './comp-b.stories.tsx' };

    const map = selectComponentEntriesByComponentId([first, second]);
    expect(map.get('comp')).toEqual(second);
  });
});

describe('componentId collision warning', () => {
  it('warns with the colliding files and the winner when several story files share a componentId', () => {
    const first = {
      ...makeStoryEntry('collide--a'),
      importPath: './first.stories.tsx',
    };
    const second = {
      ...makeStoryEntry('collide--b'),
      importPath: './second.stories.tsx',
    };

    selectComponentEntriesByComponentId([first, second]);

    expect(once.warn).toHaveBeenCalledTimes(1);
    const message = vi.mocked(once.warn).mock.calls[0][0];
    expect(message).toContain('collide');
    expect(message).toContain('./first.stories.tsx');
    expect(message).toContain('./second.stories.tsx');
    expect(message).toMatch(/'\.\/second\.stories\.tsx' only/);
  });

  it('does not warn when all stories of a componentId come from one file', () => {
    const first = {
      ...makeStoryEntry('collide--a'),
      importPath: './same.stories.tsx',
    };
    const second = {
      ...makeStoryEntry('collide--b'),
      importPath: './same.stories.tsx',
    };

    selectComponentEntriesByComponentId([first, second]);

    expect(once.warn).not.toHaveBeenCalled();
  });

  it('does not count attached docs import paths toward the story-file collision', () => {
    const storyEntry = {
      ...makeStoryEntry('collide--default'),
      importPath: './collide.stories.tsx',
    };
    const docsEntry = {
      id: 'collide--docs',
      name: 'Docs',
      title: 'Comp/Docs',
      type: 'docs',
      importPath: './collide.mdx',
      storiesImports: ['./collide.stories.tsx'],
      tags: [Tag.ATTACHED_MDX, 'docs'],
    } satisfies DocsIndexEntry;

    selectComponentEntriesByComponentId([storyEntry, docsEntry]);

    expect(once.warn).not.toHaveBeenCalled();
  });

  it('emits a byte-identical, sorted message for the same collision regardless of entry order', () => {
    const zebra = { ...makeStoryEntry('collide--a'), importPath: './zebra.stories.tsx' };
    const xylo = { ...makeStoryEntry('collide--b'), importPath: './xylo.stories.tsx' };
    const winner = { ...makeStoryEntry('collide--c'), importPath: './main.stories.tsx' };

    selectComponentEntriesByComponentId([zebra, xylo, winner]);
    selectComponentEntriesByComponentId([xylo, zebra, winner]);

    expect(once.warn).toHaveBeenCalledTimes(2);
    const [firstMessage] = vi.mocked(once.warn).mock.calls[0];
    const [secondMessage] = vi.mocked(once.warn).mock.calls[1];
    expect(secondMessage).toBe(firstMessage);
    expect(firstMessage.indexOf('./main.stories.tsx')).toBeLessThan(
      firstMessage.indexOf('./xylo.stories.tsx')
    );
    expect(firstMessage.indexOf('./xylo.stories.tsx')).toBeLessThan(
      firstMessage.indexOf('./zebra.stories.tsx')
    );
  });

  it('produces a new message when another story file joins the collision', () => {
    const first = { ...makeStoryEntry('collide--a'), importPath: './one.stories.tsx' };
    const second = { ...makeStoryEntry('collide--b'), importPath: './two.stories.tsx' };
    const third = { ...makeStoryEntry('collide--c'), importPath: './three.stories.tsx' };

    selectComponentEntriesByComponentId([first, second]);
    selectComponentEntriesByComponentId([first, second, third]);

    expect(once.warn).toHaveBeenCalledTimes(2);
    const [firstMessage] = vi.mocked(once.warn).mock.calls[0];
    const [secondMessage] = vi.mocked(once.warn).mock.calls[1];
    expect(secondMessage).not.toBe(firstMessage);
    expect(secondMessage).toContain('./three.stories.tsx');
  });

  it('produces a new message naming the new winner when the winning file changes', () => {
    const first = { ...makeStoryEntry('collide--a'), importPath: './one.stories.tsx' };
    const second = { ...makeStoryEntry('collide--b'), importPath: './two.stories.tsx' };

    selectComponentEntriesByComponentId([first, second]);
    selectComponentEntriesByComponentId([second, first]);

    expect(once.warn).toHaveBeenCalledTimes(2);
    const [firstMessage] = vi.mocked(once.warn).mock.calls[0];
    const [secondMessage] = vi.mocked(once.warn).mock.calls[1];
    expect(firstMessage).toMatch(/'\.\/two\.stories\.tsx' only/);
    expect(secondMessage).toMatch(/'\.\/one\.stories\.tsx' only/);
  });
});
