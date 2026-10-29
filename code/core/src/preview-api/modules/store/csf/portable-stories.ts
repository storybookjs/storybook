import { type CleanupCallback, isExportStory } from '../../../../csf/index.ts';
import {
  MountMustBeDestructuredError,
  ProjectAnnotationsAlreadyAppliedError,
} from '@storybook/core/internal/preview-errors';
import type {
  Args,
  Canvas,
  ComponentAnnotations,
  ComposeStoryFn,
  ComposedStoryFn,
  LegacyStoryAnnotationsOrFn,
  NamedOrDefaultProjectAnnotations,
  NormalizedProjectAnnotations,
  Parameters,
  PreparedStory,
  ProjectAnnotations,
  RenderContext,
  Renderer,
  Store_CSFExports,
  StoryContext,
  StoryContextForRender,
  StrictArgTypes,
} from '@storybook/core/internal/types';

import type { UserEventObject } from '@storybook/core/test';

import { HooksContext } from '../../../addons.ts';
import {
  isTestEnvironment,
  pauseAnimations,
  waitForAnimations,
} from '../../preview-web/render/animation-utils.ts';
import { ReporterAPI } from '../reporter-api.ts';
import { composeConfigs } from './composeConfigs.ts';
import { getCsfFactoryAnnotations } from './csf-factory-utils.ts';
import { normalizeComponentAnnotations } from './normalizeComponentAnnotations.ts';
import { normalizeProjectAnnotations } from './normalizeProjectAnnotations.ts';
import { normalizeStory } from './normalizeStory.ts';
import { hideArgTypes } from './hideArgTypes.ts';
import { prepareContext, prepareStory } from './prepareStory.ts';

// TODO we should get to the bottom of the singleton issues caused by dual ESM/CJS modules
declare global {
  var globalProjectAnnotations: NormalizedProjectAnnotations<any>;
  var defaultProjectAnnotations: ProjectAnnotations<any>;
  // Set by @storybook/addon-vitest once its setup file has applied the project annotations.
  var __STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__: boolean | undefined;
  var __STORYBOOK_SET_PROJECT_ANNOTATIONS_CALLED__: boolean | undefined;
}

/** Options of {@link createPortableStories}. */
export interface PortableStoriesOptions {
  /** Composed before the renderer defaults and the project annotations. */
  baseAnnotations?: NamedOrDefaultProjectAnnotations<any>[];
}

/** The portable stories API, bound to its base annotations. */
export interface PortableStories {
  setProjectAnnotations<TRenderer extends Renderer = Renderer>(
    projectAnnotations:
      | NamedOrDefaultProjectAnnotations<TRenderer>
      | NamedOrDefaultProjectAnnotations<TRenderer>[]
  ): NormalizedProjectAnnotations<TRenderer>;
  composeStory<TRenderer extends Renderer = Renderer, TArgs extends Args = Args>(
    storyAnnotations: LegacyStoryAnnotationsOrFn<TRenderer>,
    componentAnnotations: ComponentAnnotations<TRenderer, TArgs>,
    projectAnnotations?: ProjectAnnotations<TRenderer>,
    defaultConfig?: ProjectAnnotations<TRenderer>,
    exportsName?: string
  ): ComposedStoryFn<TRenderer, Partial<TArgs>>;
  composeStories<TModule extends Store_CSFExports>(
    storiesImport: TModule,
    globalConfig: ProjectAnnotations<Renderer>,
    composeStoryFn?: ComposeStoryFn
  ): Record<string, ComposedStoryFn>;
}

// `Symbol.for` so the marker survives the core entry points being bundled separately.
const BASE_ANNOTATIONS_APPLIED = Symbol.for('storybook.portable-stories.base-annotations-applied');
const DEFAULT_STORY_TITLE = 'ComposedStory';
const DEFAULT_STORY_NAME = 'Unnamed Story';

const cleanups: CleanupCallback[] = [];

export function setDefaultProjectAnnotations<TRenderer extends Renderer = Renderer>(
  _defaultProjectAnnotations: ProjectAnnotations<TRenderer>
): void {
  // Use a variable once we figure out the ESM/CJS issues
  globalThis.defaultProjectAnnotations = _defaultProjectAnnotations;
}

/** Marks project annotations that already include their base, so portable stories add none. */
export function markBaseAnnotationsApplied<T extends object>(annotations: T): T {
  Object.defineProperty(annotations, BASE_ANNOTATIONS_APPLIED, { value: true, configurable: true });
  return annotations;
}

/**
 * Creates the portable stories API with `baseAnnotations` composed first: base, renderer defaults,
 * project, meta, story. Annotations marked by {@link markBaseAnnotationsApplied} get no base.
 */
export function createPortableStories({
  baseAnnotations = [],
}: PortableStoriesOptions = {}): PortableStories {
  const composeStoryWithBase: PortableStories['composeStory'] = (
    storyAnnotations,
    componentAnnotations,
    projectAnnotations,
    defaultConfig,
    exportsName
  ) => {
    const needsBase =
      baseAnnotations.length > 0 &&
      !globalThis.globalProjectAnnotations &&
      ![defaultConfig, projectAnnotations].some(hasBaseAnnotationsApplied);
    return composeStoryWithDefaults(
      storyAnnotations,
      componentAnnotations,
      projectAnnotations,
      needsBase ? composeConfigs([...baseAnnotations, defaultConfig ?? {}]) : defaultConfig,
      exportsName
    );
  };

  return {
    setProjectAnnotations<TRenderer extends Renderer = Renderer>(
      projectAnnotations:
        | NamedOrDefaultProjectAnnotations<TRenderer>
        | NamedOrDefaultProjectAnnotations<TRenderer>[]
    ): NormalizedProjectAnnotations<TRenderer> {
      if (globalThis.__STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__) {
        throw new ProjectAnnotationsAlreadyAppliedError();
      }
      globalThis.__STORYBOOK_SET_PROJECT_ANNOTATIONS_CALLED__ = true;

      // `composeConfigs` reads `.default` off each entry, so falsy entries are dropped first.
      const annotations = (
        Array.isArray(projectAnnotations) ? projectAnnotations : [projectAnnotations]
      ).filter(Boolean);
      const baseApplied = annotations.some(hasBaseAnnotationsApplied);
      const base = baseApplied ? [] : baseAnnotations;
      const composed = composeConfigs<TRenderer>([
        ...base,
        globalThis.defaultProjectAnnotations ?? {},
        ...annotations,
      ]);
      globalThis.globalProjectAnnotations =
        baseApplied || base.length > 0 ? markBaseAnnotationsApplied(composed) : composed;
      return composed;
    },
    composeStory: composeStoryWithBase,
    composeStories(storiesImport, globalConfig, composeStoryFn) {
      return composeStoriesWith(
        storiesImport,
        globalConfig,
        composeStoryFn ??
          ((story, component, project, exportsName) =>
            composeStoryWithBase(story, component, project, {}, exportsName))
      );
    },
  };
}

/** The portable stories API without base annotations. */
export const { setProjectAnnotations, composeStory, composeStories } = createPortableStories();

function hasBaseAnnotationsApplied(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  return (
    BASE_ANNOTATIONS_APPLIED in entry ||
    ('default' in entry && hasBaseAnnotationsApplied(entry.default))
  );
}

function composeStoryWithDefaults<TRenderer extends Renderer = Renderer, TArgs extends Args = Args>(
  storyAnnotations: LegacyStoryAnnotationsOrFn<TRenderer>,
  componentAnnotations: ComponentAnnotations<TRenderer, TArgs>,
  projectAnnotations?: ProjectAnnotations<TRenderer>,
  defaultConfig?: ProjectAnnotations<TRenderer>,
  exportsName?: string
): ComposedStoryFn<TRenderer, Partial<TArgs>> {
  if (storyAnnotations === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error('Expected a story but received undefined.');
  }

  // @TODO: Support auto title

  componentAnnotations.title = componentAnnotations.title ?? DEFAULT_STORY_TITLE;
  const normalizedComponentAnnotations =
    normalizeComponentAnnotations<TRenderer>(componentAnnotations);

  const storyName =
    exportsName || storyAnnotations.storyName || storyAnnotations.name || DEFAULT_STORY_NAME;

  const normalizedStory = normalizeStory<TRenderer>(
    storyName,
    storyAnnotations,
    normalizedComponentAnnotations
  );

  const normalizedProjectAnnotations = normalizeProjectAnnotations<TRenderer>(
    composeConfigs([
      defaultConfig ?? globalThis.globalProjectAnnotations ?? {},
      projectAnnotations ?? {},
    ])
  );

  const story = prepareStory<TRenderer>(
    normalizedStory,
    normalizedComponentAnnotations,
    normalizedProjectAnnotations
  );

  const globals = {
    ...normalizedProjectAnnotations.initialGlobals,
    ...story.storyGlobals,
  };

  const reporting = new ReporterAPI();

  const initializeContext = () => {
    const context: StoryContextForRender<TRenderer> = prepareContext({
      hooks: new HooksContext(),
      globals,
      args: { ...story.initialArgs },
      viewMode: 'story',
      reporting,
      loaded: {},
      abortSignal: new AbortController().signal,
      step: (label, play) => story.runStep(label, play, hideArgTypes(context)),
      canvasElement: null!,
      canvas: {} as Canvas,
      userEvent: {} as UserEventObject,
      globalTypes: normalizedProjectAnnotations.globalTypes,
      ...story,
      context: null!,
      mount: null!,
    });

    context.parameters.__isPortableStory = true;

    context.context = context;

    if (story.renderToCanvas) {
      context.renderToCanvas = async () => {
        // TODO: Consolidate this renderContext with Context in SB 10.0
        // Change renderToCanvas function to only use the context object
        // and to make the renderContext an internal implementation detail
        // wasn't possible so far because showError and showException are not part of the story context (yet)
        const unmount = await story.renderToCanvas?.(
          {
            componentId: story.componentId,
            title: story.title,
            id: story.id,
            name: story.name,
            tags: story.tags,
            showMain: () => {},
            showError: (error): void => {
              throw new Error(`${error.title}\n${error.description}`);
            },
            showException: (error): void => {
              throw error;
            },
            forceRemount: true,
            storyContext: context,
            storyFn: () => story.unboundStoryFn(context),
            unboundStoryFn: story.unboundStoryFn,
          } as RenderContext<TRenderer>,
          context.canvasElement
        );
        if (unmount) {
          cleanups.push(unmount);
        }
        // `hooks` is loosely typed (`unknown`) on the portable story context.
        const hooks = context.hooks as HooksContext<TRenderer>;
        // Register the hook teardown BEFORE flushing so a throwing effect can't skip it: `clean()`
        // runs the effect destroy fns on the next run/explicit cleanup (mirroring
        // `StoryStore.cleanupStory`), so the applied effects survive through play + the a11y
        // `afterEach` of this run.
        cleanups.push(() => hooks.clean());
        // In the browser (PreviewWeb) path, preview-api `useEffect` callbacks registered during
        // render are flushed when `StoryRender` emits `STORY_RENDERED`, whose listener also detaches
        // the hooks context. The portable path never emits that event, so invoke the same listener
        // directly here (after the render resolves, before play + the a11y `afterEach` observe the
        // DOM): it triggers the effects (e.g. `@storybook/addon-themes` setting `data-theme` on
        // `<html>`), clears the current context, and removes the now-stale render listener. (Effect-
        // only decorators; preview-api state updates that re-render are a separate, unsupported case.)
        hooks.renderListener(context.id);
      };
    }

    context.mount = story.mount(context);

    return context;
  };

  let loadedContext: StoryContextForRender<TRenderer> | undefined;

  const play = async (extraContext?: Partial<StoryContext<TRenderer, Partial<TArgs>>>) => {
    const context = initializeContext();
    context.canvasElement ??= globalThis?.document?.body;
    if (loadedContext) {
      context.loaded = loadedContext.loaded;
    }
    Object.assign(context, extraContext);
    return story.playFunction!(hideArgTypes(context));
  };

  const run = (extraContext?: Partial<StoryContext<TRenderer, Partial<TArgs>>>) => {
    const context = initializeContext();
    Object.assign(context, extraContext);
    return runStory(story, context);
  };

  const playFunction = story.playFunction ? play : undefined;

  const composedStory: ComposedStoryFn<TRenderer, Partial<TArgs>> = Object.assign(
    function storyFn(extraArgs?: Partial<TArgs>) {
      const context = initializeContext();
      if (loadedContext) {
        context.loaded = loadedContext.loaded;
      }
      context.args = {
        ...context.initialArgs,
        ...extraArgs,
      };
      return story.unboundStoryFn(context);
    },
    {
      id: story.id,
      storyName,
      load: async () => {
        // First run any registered cleanup function

        // First run any registered cleanup function
        for (const callback of [...cleanups].reverse()) {
          await callback();
        }
        cleanups.length = 0;

        const context = initializeContext();
        const hookContext = hideArgTypes(context);

        context.loaded = await story.applyLoaders(hookContext);

        cleanups.push(...(await story.applyBeforeEach(hookContext)).filter(Boolean));

        loadedContext = context;
      },
      globals,
      args: story.initialArgs as Partial<TArgs>,
      parameters: story.parameters as Parameters,
      argTypes: story.argTypes as StrictArgTypes<TArgs>,
      play: playFunction!,
      run,
      reporting,
      tags: story.tags,
    }
  );

  return composedStory;
}

function composeStoriesWith<TModule extends Store_CSFExports>(
  storiesImport: TModule,
  globalConfig: ProjectAnnotations<Renderer>,
  composeStoryFn: ComposeStoryFn
): Record<string, ComposedStoryFn> {
  const { default: metaExport, __esModule, __namedExportsOrder, ...stories } = storiesImport;
  let meta = metaExport;

  const composedStories = Object.entries(stories).reduce<Record<string, ComposedStoryFn>>(
    (storiesMap, [exportsName, story]: [string, any]) => {
      const { story: storyAnnotations, meta: componentAnnotations } =
        getCsfFactoryAnnotations(story);
      if (!meta && componentAnnotations) {
        meta = componentAnnotations;
      }

      if (!isExportStory(exportsName, meta)) {
        return storiesMap;
      }
      const result = Object.assign(storiesMap, {
        [exportsName]: composeStoryFn(storyAnnotations, meta, globalConfig, exportsName),
      });
      return result;
    },
    {}
  );

  return composedStories;
}

// TODO At some point this function should live in prepareStory and become the core of StoryRender.render as well.
// Will make a follow up PR for that
async function runStory<TRenderer extends Renderer>(
  story: PreparedStory<TRenderer>,
  context: StoryContextForRender<TRenderer>
) {
  for (const callback of [...cleanups].reverse()) {
    await callback();
  }
  cleanups.length = 0;
  const hookContext = hideArgTypes(context);

  if (!context.canvasElement) {
    const container = document.createElement('div');
    globalThis?.document?.body?.appendChild(container);
    context.canvasElement = container;
    cleanups.push(() => {
      if (globalThis?.document?.body?.contains(container)) {
        globalThis?.document?.body?.removeChild(container);
      }
    });
  }

  context.loaded = await story.applyLoaders(hookContext);

  if (context.abortSignal.aborted) {
    return;
  }

  cleanups.push(...(await story.applyBeforeEach(hookContext)).filter(Boolean));

  const playFunction = story.playFunction;

  const isMountDestructured = story.usesMount;

  if (!isMountDestructured) {
    await context.mount();
  }

  if (context.abortSignal.aborted) {
    return;
  }

  if (playFunction) {
    if (!isMountDestructured) {
      context.mount = async () => {
        throw new MountMustBeDestructuredError({ playFunction: playFunction.toString() });
      };
    }
    await playFunction(hookContext);
  }

  let cleanUp: CleanupCallback | undefined;
  if (isTestEnvironment()) {
    cleanUp = pauseAnimations();
  } else {
    await waitForAnimations(context.abortSignal);
  }

  try {
    await story.applyAfterEach(hookContext);
  } finally {
    await cleanUp?.();
  }
}
