/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/naming-convention */
import { type CleanupCallback, isExportStory } from '@storybook/csf';
import dedent from 'ts-dedent';
import type {
  Renderer,
  Args,
  ComponentAnnotations,
  LegacyStoryAnnotationsOrFn,
  NamedOrDefaultProjectAnnotations,
  ComposedStoryPlayFn,
  ComposeStoryFn,
  Store_CSFExports,
  StoryContext,
  Parameters,
  ComposedStoryFn,
  StrictArgTypes,
  PlayFunctionContext,
  ProjectAnnotations,
} from '@storybook/types';

import { HooksContext } from '../../../addons';
import { composeConfigs } from './composeConfigs';
import { prepareContext, prepareStory } from './prepareStory';
import { normalizeStory } from './normalizeStory';
import { normalizeComponentAnnotations } from './normalizeComponentAnnotations';
import { getValuesFromArgTypes } from './getValuesFromArgTypes';
import { normalizeProjectAnnotations } from './normalizeProjectAnnotations';

let globalProjectAnnotations: ProjectAnnotations<any> = {};

const DEFAULT_STORY_TITLE = 'ComposedStory';
const DEFAULT_STORY_NAME = 'Unnamed Story';

function extractAnnotation<TRenderer extends Renderer = Renderer>(
  annotation: NamedOrDefaultProjectAnnotations<TRenderer>
) {
  // support imports such as
  // import * as annotations from '.storybook/preview'
  // in both cases: 1 - the file has a default export; 2 - named exports only
  return 'default' in annotation ? annotation.default : annotation;
}

export function setProjectAnnotations<TRenderer extends Renderer = Renderer>(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<TRenderer>
    | NamedOrDefaultProjectAnnotations<TRenderer>[]
) {
  const annotations = Array.isArray(projectAnnotations) ? projectAnnotations : [projectAnnotations];
  globalProjectAnnotations = composeConfigs(annotations.map(extractAnnotation));
}

const cleanups: { storyName: string; callback: CleanupCallback }[] = [];

export function composeStory<TRenderer extends Renderer = Renderer, TArgs extends Args = Args>(
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
    exportsName ||
    storyAnnotations.storyName ||
    storyAnnotations.story?.name ||
    storyAnnotations.name ||
    DEFAULT_STORY_NAME;

  const normalizedStory = normalizeStory<TRenderer>(
    storyName,
    storyAnnotations,
    normalizedComponentAnnotations
  );

  const normalizedProjectAnnotations = normalizeProjectAnnotations<TRenderer>(
    composeConfigs([defaultConfig ?? {}, globalProjectAnnotations, projectAnnotations ?? {}])
  );

  const story = prepareStory<TRenderer>(
    normalizedStory,
    normalizedComponentAnnotations,
    normalizedProjectAnnotations
  );

  const globalsFromGlobalTypes = getValuesFromArgTypes(normalizedProjectAnnotations.globalTypes);

  const context: StoryContext<TRenderer> = {
    hooks: new HooksContext(),
    globals: {
      ...globalsFromGlobalTypes,
      ...normalizedProjectAnnotations.globals,
    },
    args: { ...story.initialArgs },
    viewMode: 'story',
    loaded: {},
    abortSignal: null as unknown as AbortSignal,
    canvasElement: null,
    ...story,
  };

  const playFunction = story.playFunction
    ? async (extraContext: Partial<PlayFunctionContext<TRenderer, TArgs>>) =>
        story.playFunction!({
          ...context,
          ...extraContext,
          canvasElement: extraContext?.canvasElement ?? globalThis.document?.body,
        })
    : undefined;

  let previousCleanupsDone = false;

  const composedStory: ComposedStoryFn<TRenderer, Partial<TArgs>> = Object.assign(
    function storyFn(extraArgs?: Partial<TArgs>) {
      context.args = {
        ...context.initialArgs,
        ...extraArgs,
      };

      if (cleanups.length > 0 && !previousCleanupsDone) {
        let humanReadableIdentifier = storyName;
        if (story.title !== DEFAULT_STORY_TITLE) {
          // prefix with title unless it's the generic ComposedStory title
          humanReadableIdentifier = `${story.title} - ${humanReadableIdentifier}`;
        }
        if (storyName === DEFAULT_STORY_NAME && Object.keys(context.args).length > 0) {
          // suffix with args if it's an unnamed story and there are args
          humanReadableIdentifier = `${humanReadableIdentifier} (${Object.keys(context.args).join(
            ', '
          )})`;
        }
        console.warn(
          dedent`Some stories were not cleaned up before rendering '${humanReadableIdentifier}'.
          
          You should load the story with \`await Story.load()\` before rendering it.`
        );
        // TODO: Add a link to the docs when they are ready
        // eg. "See https://storybook.js.org/docs/api/portable-stories-${process.env.JEST_WORKER_ID !== undefined ? 'jest' : 'vitest'}#3-load for more information."
      }
      return story.unboundStoryFn(prepareContext(context));
    },
    {
      id: story.id,
      storyName,
      load: async () => {
        // First run any registered cleanup function
        for (const { callback } of [...cleanups].reverse()) await callback();
        cleanups.length = 0;

        previousCleanupsDone = true;

        const loadedContext = await story.applyLoaders(context);
        context.loaded = loadedContext.loaded;

        cleanups.push(
          ...(await story.applyBeforeEach(context))
            .filter(Boolean)
            .map((callback) => ({ storyName, callback }))
        );
      },
      args: story.initialArgs as Partial<TArgs>,
      parameters: story.parameters as Parameters,
      argTypes: story.argTypes as StrictArgTypes<TArgs>,
      play: playFunction as ComposedStoryPlayFn<TRenderer, TArgs> | undefined,
      tags: story.tags,
    }
  );

  return composedStory;
}

export function composeStories<TModule extends Store_CSFExports>(
  storiesImport: TModule,
  globalConfig: ProjectAnnotations<Renderer>,
  composeStoryFn: ComposeStoryFn
) {
  const { default: meta, __esModule, __namedExportsOrder, ...stories } = storiesImport;
  const composedStories = Object.entries(stories).reduce((storiesMap, [exportsName, story]) => {
    if (!isExportStory(exportsName, meta)) {
      return storiesMap;
    }

    const result = Object.assign(storiesMap, {
      [exportsName]: composeStoryFn(
        story as LegacyStoryAnnotationsOrFn,
        meta,
        globalConfig,
        exportsName
      ),
    });
    return result;
  }, {});

  return composedStories;
}

type WrappedStoryRef = { __pw_type: 'jsx' | 'importRef' };
type UnwrappedJSXStoryRef = {
  __pw_type: 'jsx';
  type: ComposedStoryFn;
};
type UnwrappedImportStoryRef = ComposedStoryFn;

declare global {
  function __pwUnwrapObject(
    storyRef: WrappedStoryRef
  ): Promise<UnwrappedJSXStoryRef | UnwrappedImportStoryRef>;
}

export function createPlaywrightTest<TFixture extends { extend: any }>(
  baseTest: TFixture
): TFixture {
  return baseTest.extend({
    mount: async ({ mount, page }: any, use: any) => {
      await use(async (storyRef: WrappedStoryRef, ...restArgs: any) => {
        // Playwright CT deals with JSX import references differently than normal imports
        // and we can currently only handle JSX import references
        if (
          !('__pw_type' in storyRef) ||
          ('__pw_type' in storyRef && storyRef.__pw_type !== 'jsx')
        ) {
          // eslint-disable-next-line local-rules/no-uncategorized-errors
          throw new Error(dedent`
              Portable stories in Playwright CT only work when referencing JSX elements.
              Please use JSX format for your components such as:
              
              instead of:
              await mount(MyComponent, { props: { foo: 'bar' } })
              
              do:
              await mount(<MyComponent foo="bar"/>)

              More info: https://storybook.js.org/docs/api/portable-stories-playwright
            `);
        }

        await page.evaluate(async (wrappedStoryRef: WrappedStoryRef) => {
          const unwrappedStoryRef = await globalThis.__pwUnwrapObject?.(wrappedStoryRef);
          const story =
            '__pw_type' in unwrappedStoryRef ? unwrappedStoryRef.type : unwrappedStoryRef;
          return story?.load?.();
        }, storyRef);

        // mount the story
        const mountResult = await mount(storyRef, ...restArgs);

        // play the story in the browser
        await page.evaluate(async (wrappedStoryRef: WrappedStoryRef) => {
          const unwrappedStoryRef = await globalThis.__pwUnwrapObject?.(wrappedStoryRef);
          const story =
            '__pw_type' in unwrappedStoryRef ? unwrappedStoryRef.type : unwrappedStoryRef;
          const canvasElement = document.querySelector('#root');
          return story?.play?.({ canvasElement });
        }, storyRef);

        return mountResult;
      });
    },
  });
}
