import type { Mock, Mocked } from 'vitest';
import { vi } from 'vitest';

import type {
  ModuleImportFn,
  ProjectAnnotations,
  Renderer,
  StoryIndex,
  TeardownRenderToCanvas,
} from '@storybook/core/types';

import {
  DOCS_RENDERED,
  STORY_ERRORED,
  STORY_MISSING,
  STORY_RENDERED,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
} from '@storybook/core/core-events';

import { EventEmitter } from 'events';

import { composeConfigs } from '../store';
import type { RenderPhase } from './render/StoryRender';

export const componentOneExports = {
  default: {
    title: 'Component One',
    argTypes: {
      foo: { type: { name: 'string' } },
      one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
    },
    loaders: [vi.fn()],
    parameters: {
      docs: { page: vi.fn(), container: vi.fn() },
    },
  },
  a: { args: { foo: 'a', one: 1 }, play: vi.fn() },
  b: { args: { foo: 'b', one: 1 }, play: vi.fn() },
};
export const componentTwoExports = {
  default: { title: 'Component Two' },
  c: { args: { foo: 'c' } },
};
export const attachedDocsExports = {
  default: vi.fn(),
};
export const unattachedDocsExports = {
  default: vi.fn(),
};
// If a second file defines stories for componentOne
export const extraComponentOneExports = {
  default: {
    title: 'Component One',
    parameters: {
      docs: { page: vi.fn() },
    },
  },
  e: {},
};
export const importFn: Mocked<ModuleImportFn> = vi.fn(
  async (path: string) =>
    ({
      './src/ComponentOne.stories.js': componentOneExports,
      './src/ComponentOne.mdx': attachedDocsExports,
      './src/ComponentTwo.stories.js': componentTwoExports,
      './src/Introduction.mdx': unattachedDocsExports,
      './src/ExtraComponentOne.stories.js': extraComponentOneExports,
    })[path] || {}
);

export const docsRenderer = {
  render: vi.fn().mockImplementation((context, parameters, element) => Promise.resolve()),
  unmount: vi.fn(),
};
export const teardownrenderToCanvas: Mock<(teardown: TeardownRenderToCanvas) => void> = vi.fn();
const rawProjectAnnotations = {
  initialGlobals: { a: 'b' },
  globalTypes: {},
  decorators: [vi.fn((s) => s())],
  render: vi.fn(),
  renderToCanvas: vi.fn().mockReturnValue(teardownrenderToCanvas),
  parameters: { docs: { renderer: () => docsRenderer } },
};
export const projectAnnotations = composeConfigs([
  rawProjectAnnotations,
]) as ProjectAnnotations<Renderer> & typeof rawProjectAnnotations;

export const getProjectAnnotations = vi.fn(() => projectAnnotations as any);

export const storyIndex: StoryIndex = {
  v: 5,
  entries: {
    'component-one--docs': {
      type: 'docs',
      id: 'component-one--docs',
      title: 'Component One',
      name: 'Docs',
      importPath: './src/ComponentOne.stories.js',
      storiesImports: ['./src/ExtraComponentOne.stories.js'],
      tags: ['autodocs', 'docs'],
    },
    'component-one--attached-docs': {
      type: 'docs',
      id: 'component-one--attached-docs',
      title: 'Component One',
      name: 'Attached Docs',
      importPath: './src/ComponentOne.mdx',
      storiesImports: ['./src/ComponentOne.stories.js'],
      tags: ['attached-mdx', 'docs'],
    },
    'component-one--a': {
      type: 'story',
      id: 'component-one--a',
      title: 'Component One',
      name: 'A',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-one--b': {
      type: 'story',
      id: 'component-one--b',
      title: 'Component One',
      name: 'B',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-one--e': {
      type: 'story',
      id: 'component-one--e',
      title: 'Component One',
      name: 'E',
      importPath: './src/ExtraComponentOne.stories.js',
    },
    'component-two--docs': {
      type: 'docs',
      id: 'component-two--docs',
      title: 'Component Two',
      name: 'Docs',
      importPath: './src/ComponentTwo.stories.js',
      storiesImports: [],
      tags: ['autodocs', 'docs'],
    },
    'component-two--c': {
      type: 'story',
      id: 'component-two--c',
      title: 'Component Two',
      name: 'C',
      importPath: './src/ComponentTwo.stories.js',
    },
    'introduction--docs': {
      type: 'docs',
      id: 'introduction--docs',
      title: 'Introduction',
      name: 'Docs',
      importPath: './src/Introduction.mdx',
      storiesImports: ['./src/ComponentTwo.stories.js'],
      tags: ['unattached-mdx', 'docs'],
    },
  },
};
export const getStoryIndex = () => storyIndex;

export const emitter = new EventEmitter();
export const mockChannel = {
  on: emitter.on.bind(emitter),
  off: emitter.off.bind(emitter),
  removeListener: emitter.off.bind(emitter),
  emit: vi.fn(emitter.emit.bind(emitter)),
  // emit: emitter.emit.bind(emitter),
};

export const waitForEvents = (
  events: string[],
  predicate: (...args: any[]) => boolean = () => true,
  debugLabel?: string
) => {
  // We've already emitted a render event. NOTE if you want to test a second call,
  // ensure you call `mockChannel.emit.mockClear()` before `waitFor...`
  if (
    mockChannel.emit.mock.calls.find(
      (call: string[]) => events.includes(call[0]) && predicate(...call.slice(1))
    )
  ) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const listener = (...args: any[]) => {
      if (!predicate(...args)) {
        return;
      }
      events.forEach((event) => mockChannel.off(event, listener));
      resolve(null);
    };
    events.forEach((event) => mockChannel.on(event, listener));

    // Don't wait too long
    waitForQuiescence().then(() =>
      reject(new Error(`Event was not emitted in time: ${debugLabel || events}`))
    );
  });
};

// The functions on the preview that trigger rendering don't wait for
// the async parts, so we need to listen for the "done" events
export const waitForRender = () =>
  waitForEvents([
    STORY_RENDERED,
    DOCS_RENDERED,
    STORY_THREW_EXCEPTION,
    STORY_ERRORED,
    STORY_MISSING,
  ]);

export const waitForRenderPhase = (phase: RenderPhase) => {
  const label = `${STORY_RENDER_PHASE_CHANGED} to ${phase}`;
  return waitForEvents([STORY_RENDER_PHASE_CHANGED], ({ newPhase }) => newPhase === phase, label);
};

// A little trick to ensure that we always call the real `setTimeout` even when timers are mocked
const realSetTimeout = setTimeout;
export const waitForQuiescence = async () => new Promise((r) => realSetTimeout(r, 1_000));
