import { describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import type { CSFFile, Renderer } from 'storybook/internal/types';

import type { StoryStore } from '../../store/index.ts';
import { DocsContext } from './DocsContext.ts';
import { csfFileParts } from './test-utils.ts';

const channel = new Channel({});
const renderStoryToElement = vi.fn();

describe('referenceCSFFile', () => {
  it('deals with unattached "docsOnly" csf files', () => {
    const unattachedCsfFile = {
      stories: {
        'meta--page': {
          id: 'meta--page',
          name: 'Page',
          parameters: { docsOnly: true },
          moduleExport: {},
        },
      },
      meta: { id: 'meta', title: 'Meta' },
      moduleExports: {},
    } as CSFFile;

    const store = {
      componentStoriesFromCSFFile: () => [],
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [unattachedCsfFile]);

    expect(() => context.storyById()).toThrow(/No primary story/);
  });
});

describe('attachCSFFile', () => {
  const firstCsfParts = csfFileParts('first-meta--first-story', 'first-meta');
  const secondCsfParts = csfFileParts('second-meta--second-story', 'second-meta');
  const store = {
    componentStoriesFromCSFFile: ({ csfFile }: { csfFile: CSFFile }) =>
      csfFile === firstCsfParts.csfFile ? [firstCsfParts.story] : [secondCsfParts.story],
  } as unknown as StoryStore<Renderer>;

  it('attaches multiple CSF files', () => {
    // Arrange - create a context with both CSF files
    const context = new DocsContext(channel, store, renderStoryToElement, [
      firstCsfParts.csfFile,
      secondCsfParts.csfFile,
    ]);

    // Act - attach the first CSF file
    context.attachCSFFile(firstCsfParts.csfFile);

    // Assert - the first story is now the primary story and the only component story
    expect(context.storyById()).toEqual(firstCsfParts.story);
    expect(context.componentStories()).toEqual([firstCsfParts.story]);

    // Assert - stories from both CSF files are available
    expect(context.componentStoriesFromCSFFile(firstCsfParts.csfFile)).toEqual([
      firstCsfParts.story,
    ]);
    expect(context.componentStoriesFromCSFFile(secondCsfParts.csfFile)).toEqual([
      secondCsfParts.story,
    ]);

    // Act - attach the second CSF file
    context.attachCSFFile(secondCsfParts.csfFile);

    // Assert - the first story is still the primary story but both stories are available
    expect(context.storyById()).toEqual(firstCsfParts.story);
    expect(context.componentStories()).toEqual([firstCsfParts.story, secondCsfParts.story]);

    // Act - attach the second CSF file again
    context.attachCSFFile(secondCsfParts.csfFile);

    // Assert - still only two stories are available
    expect(context.storyById()).toEqual(firstCsfParts.story);
    expect(context.componentStories()).toEqual([firstCsfParts.story, secondCsfParts.story]);
  });
});

describe('referenceMeta', () => {
  it('works with different module namespace object but same default export (Rolldown compatibility)', () => {
    // This test simulates what happens with Rolldown bundler:
    // The module namespace object from MDX import differs from the one stored in CSFFile,
    // but the .default property (meta export) is the same object reference
    const { story, csfFile, metaExport, storyExport } = csfFileParts();
    const store = {
      componentStoriesFromCSFFile: () => [story],
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [csfFile]);

    // Create a different namespace object with the same default export
    // This simulates Rolldown's behavior where namespace objects are not singletons
    const differentModuleExports = { default: metaExport, story: storyExport };

    // This should NOT throw, as we can resolve via the .default property
    expect(() => context.referenceMeta(differentModuleExports, true)).not.toThrow();
    expect(context.storyById()).toEqual(story);
  });

  it('throws for non-module objects (components)', () => {
    const { story, csfFile, component } = csfFileParts();
    const store = {
      componentStoriesFromCSFFile: () => [story],
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [csfFile]);

    // Passing a component directly should throw
    expect(() => context.referenceMeta(component, true)).toThrow(
      '<Meta of={} /> must reference a CSF file module export or meta export. Did you mistakenly reference your component instead of your CSF file?'
    );
  });

  it('works with different module namespace objects when there is no default export', () => {
    // Simulates CSF4 modules (no `export default meta`) split into a chunk:
    // the MDX-imported namespace differs by identity from the one Storybook registered.
    // Resolution should fall back to looking up the CSF file via any story export.
    const { story, csfFile, storyExport } = csfFileParts('meta--story', 'meta', {
      includeDefaultExport: false,
    });
    const store = {
      componentStoriesFromCSFFile: () => [story],
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [csfFile]);

    const differentModuleExports = { story: storyExport };

    expect(() => context.referenceMeta(differentModuleExports, true)).not.toThrow();
    expect(context.storyById()).toEqual(story);
  });

  it('throws for module objects whose story exports span multiple CSF files', () => {
    const firstParts = csfFileParts('first-meta--first-story', 'first-meta', {
      includeDefaultExport: false,
    });
    const secondParts = csfFileParts('second-meta--second-story', 'second-meta', {
      includeDefaultExport: false,
    });
    const store = {
      componentStoriesFromCSFFile: ({ csfFile }: { csfFile: CSFFile }) =>
        csfFile === firstParts.csfFile ? [firstParts.story] : [secondParts.story],
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [
      firstParts.csfFile,
      secondParts.csfFile,
    ]);

    const mixedModuleExports = {
      first: firstParts.storyExport,
      second: secondParts.storyExport,
    };

    expect(() => context.referenceMeta(mixedModuleExports, true)).toThrow(
      '<Meta of={} /> must reference a CSF file module export or meta export. Did you mistakenly reference your component instead of your CSF file?'
    );
  });
});

describe('resolveOf', () => {
  const { story, csfFile, storyExport, metaExport, moduleExports, component } = csfFileParts();

  describe('attached', () => {
    const projectAnnotations = { render: vi.fn() };
    const store = {
      componentStoriesFromCSFFile: () => [story],
      preparedMetaFromCSFFile: () => ({ prepareMeta: 'preparedMeta' }),
      projectAnnotations,
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [csfFile]);
    context.attachCSFFile(csfFile);

    it('works for story exports', () => {
      expect(context.resolveOf(storyExport)).toEqual({ type: 'story', story });
    });

    it('works for meta exports', () => {
      expect(context.resolveOf(metaExport)).toEqual({
        type: 'meta',
        csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('works for full module exports', () => {
      expect(context.resolveOf(moduleExports)).toEqual({
        type: 'meta',
        csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('works for module exports with different object identity but same default (Rolldown compatibility)', () => {
      // Simulate what happens in Rolldown: different namespace object but same default export
      const differentModuleExports = { default: metaExport, story: storyExport };
      expect(context.resolveOf(differentModuleExports)).toEqual({
        type: 'meta',
        csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('works for CSF4 module exports with different object identity and no default export', () => {
      // CSF4 modules (no `export default meta`) may be split into a separate chunk,
      // producing a namespace object whose identity differs from Storybook's record.
      // Resolution falls back to identifying the CSF file via the story exports.
      const noDefaultParts = csfFileParts('meta--no-default-story', 'meta-no-default', {
        includeDefaultExport: false,
      });
      const noDefaultStore = {
        componentStoriesFromCSFFile: () => [noDefaultParts.story],
        preparedMetaFromCSFFile: () => ({ prepareMeta: 'preparedMeta' }),
        projectAnnotations,
      } as unknown as StoryStore<Renderer>;
      const noDefaultContext = new DocsContext(channel, noDefaultStore, renderStoryToElement, [
        noDefaultParts.csfFile,
      ]);
      noDefaultContext.attachCSFFile(noDefaultParts.csfFile);

      expect(noDefaultContext.resolveOf({ story: noDefaultParts.storyExport })).toEqual({
        type: 'meta',
        csfFile: noDefaultParts.csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('resolves a CSF4 Story object to its story, not its containing CSF file', () => {
      // A CSF4 Story (detected via `_tag === 'Story'`) is an individual export,
      // not a namespace. The namespace fallback must skip it so that
      // <Canvas of={Stories.Primary} /> still resolves to the Primary story.
      const csf4Story = { _tag: 'Story', input: storyExport };
      expect(context.resolveOf(csf4Story, ['story'])).toEqual({ type: 'story', story });
    });

    it('works for components', () => {
      expect(context.resolveOf(component)).toEqual({
        type: 'component',
        component,
        projectAnnotations: expect.objectContaining(projectAnnotations),
      });
    });

    it('finds primary story', () => {
      expect(context.resolveOf('story')).toEqual({ type: 'story', story });
    });

    it('finds attached CSF file', () => {
      expect(context.resolveOf('meta')).toEqual({
        type: 'meta',
        csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('finds attached component', () => {
      expect(context.resolveOf('component')).toEqual({
        type: 'component',
        component,
        projectAnnotations: expect.objectContaining(projectAnnotations),
      });
    });

    describe('validation allowed', () => {
      it('works for story exports', () => {
        expect(context.resolveOf(storyExport, ['story'])).toEqual({ type: 'story', story });
      });

      it('works for meta exports', () => {
        expect(context.resolveOf(metaExport, ['meta'])).toEqual({
          type: 'meta',
          csfFile,
          preparedMeta: expect.any(Object),
        });
      });

      it('works for full module exports', () => {
        expect(context.resolveOf(moduleExports, ['meta'])).toEqual({
          type: 'meta',
          csfFile,
          preparedMeta: expect.any(Object),
        });
      });

      it('works for components', () => {
        expect(context.resolveOf(component, ['component'])).toEqual({
          type: 'component',
          component,
          projectAnnotations: expect.objectContaining(projectAnnotations),
        });
      });

      it('finds primary story', () => {
        expect(context.resolveOf('story', ['story'])).toEqual({ type: 'story', story });
      });

      it('finds attached CSF file', () => {
        expect(context.resolveOf('meta', ['meta'])).toEqual({
          type: 'meta',
          csfFile,
          preparedMeta: expect.any(Object),
        });
      });

      it('finds attached component', () => {
        expect(context.resolveOf('component', ['component'])).toEqual({
          type: 'component',
          component,
          projectAnnotations: expect.objectContaining(projectAnnotations),
        });
      });
    });

    describe('validation rejected', () => {
      it('works for story exports', () => {
        expect(() => context.resolveOf(storyExport, ['meta'])).toThrow('Invalid value passed');
      });

      it('works for meta exports', () => {
        expect(() => context.resolveOf(metaExport, ['story'])).toThrow('Invalid value passed');
      });

      it('works for full module exports', () => {
        expect(() => context.resolveOf(moduleExports, ['story'])).toThrow('Invalid value passed');
      });

      it('works for components', () => {
        expect(() => context.resolveOf(component, ['story', 'meta'])).toThrow(
          'Invalid value passed'
        );
      });

      it('finds primary story', () => {
        expect(() => context.resolveOf('story', ['component'])).toThrow('Invalid value passed');
      });

      it('finds attached CSF file', () => {
        expect(() => context.resolveOf('meta', ['story'])).toThrow('Invalid value passed');
      });

      it('finds attached component', () => {
        expect(() => context.resolveOf('component', ['meta'])).toThrow('Invalid value passed');
      });
    });
  });

  describe('unattached', () => {
    const projectAnnotations = { render: vi.fn() };
    const store = {
      componentStoriesFromCSFFile: () => [story],
      preparedMetaFromCSFFile: () => ({ prepareMeta: 'preparedMeta' }),
      projectAnnotations,
    } as unknown as StoryStore<Renderer>;
    const context = new DocsContext(channel, store, renderStoryToElement, [csfFile]);

    it('works for story exports', () => {
      expect(context.resolveOf(storyExport)).toEqual({ type: 'story', story });
    });

    it('works for meta exports', () => {
      expect(context.resolveOf(metaExport)).toEqual({
        type: 'meta',
        csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('works for full module exports', () => {
      expect(context.resolveOf(moduleExports)).toEqual({
        type: 'meta',
        csfFile,
        preparedMeta: expect.any(Object),
      });
    });

    it('works for components', () => {
      expect(context.resolveOf(component)).toEqual({
        type: 'component',
        component,
        projectAnnotations: expect.objectContaining(projectAnnotations),
      });
    });

    it('throws for primary story', () => {
      expect(() => context.resolveOf('story')).toThrow('No primary story attached');
    });

    it('throws for attached CSF file', () => {
      expect(() => context.resolveOf('meta')).toThrow('No CSF file attached');
    });

    it('throws for attached component', () => {
      expect(() => context.resolveOf('component')).toThrow('No CSF file attached');
    });
  });
});
