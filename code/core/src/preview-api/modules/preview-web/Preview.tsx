import { global } from '@storybook/global';
import { deprecate, logger } from '@storybook/core/client-logger';
import type {
  ArgTypesRequestPayload,
  ArgTypesResponsePayload,
  RequestData,
  ResponseData,
} from '@storybook/core/core-events';
import {
  ARGTYPES_INFO_REQUEST,
  ARGTYPES_INFO_RESPONSE,
  CONFIG_ERROR,
  FORCE_REMOUNT,
  FORCE_RE_RENDER,
  GLOBALS_UPDATED,
  RESET_STORY_ARGS,
  SET_GLOBALS,
  STORY_ARGS_UPDATED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
} from '@storybook/core/core-events';
import type { CleanupCallback } from '@storybook/csf';
import type { Channel } from '@storybook/core/channels';
import type {
  Renderer,
  Args,
  Globals,
  ModuleImportFn,
  RenderContextCallbacks,
  RenderToCanvas,
  PreparedStory,
  StoryIndex,
  ProjectAnnotations,
  StoryId,
  StoryRenderOptions,
  SetGlobalsPayload,
  GlobalsUpdatedPayload,
} from '@storybook/core/types';
import {
  CalledPreviewMethodBeforeInitializationError,
  MissingRenderToCanvasError,
  StoryIndexFetchError,
  StoryStoreAccessedBeforeInitializationError,
} from '@storybook/core/preview-errors';
import { addons } from '../addons';
import { StoryStore } from '../../store';

import { StoryRender } from './render/StoryRender';
import type { CsfDocsRender } from './render/CsfDocsRender';
import type { MdxDocsRender } from './render/MdxDocsRender';

const { fetch } = global;

const STORY_INDEX_PATH = './index.json';

export type MaybePromise<T> = Promise<T> | T;

export class Preview<TRenderer extends Renderer> {
  /**
   * @deprecated will be removed in 8.0, please use channel instead
   */
  serverChannel?: Channel;

  protected storyStoreValue?: StoryStore<TRenderer>;

  renderToCanvas?: RenderToCanvas<TRenderer>;

  storyRenders: StoryRender<TRenderer>[] = [];

  previewEntryError?: Error;

  // While we wait for the index to load (note it may error for a while), we need to store the
  // project annotations. Once the index loads, it is stored on the store and this will get unset.
  private projectAnnotationsBeforeInitialization?: ProjectAnnotations<TRenderer>;

  private beforeAllCleanup?: CleanupCallback | void;

  protected storeInitializationPromise: Promise<void>;

  protected resolveStoreInitializationPromise!: () => void;

  protected rejectStoreInitializationPromise!: (err: Error) => void;

  constructor(
    public importFn: ModuleImportFn,

    public getProjectAnnotations: () => MaybePromise<ProjectAnnotations<TRenderer>>,

    protected channel: Channel = addons.getChannel(),

    shouldInitialize = true
  ) {
    this.storeInitializationPromise = new Promise((resolve, reject) => {
      this.resolveStoreInitializationPromise = resolve;
      this.rejectStoreInitializationPromise = reject;
    });

    // Cannot await this in constructor, but if you want to await it, use `ready()`
    if (shouldInitialize) this.initialize();
  }

  // Create a proxy object for `__STORYBOOK_STORY_STORE__` and `__STORYBOOK_PREVIEW__.storyStore`
  // That proxies through to the store once ready, and errors beforehand. This means we can set
  // `__STORYBOOK_STORY_STORE__ = __STORYBOOK_PREVIEW__.storyStore` without having to wait, and
  // similarly integrators can access the `storyStore` on the preview at any time, although
  // it is considered deprecated and we will no longer allow access in 9.0
  get storyStore() {
    return new Proxy(
      {},
      {
        get: (_, method) => {
          if (this.storyStoreValue) {
            deprecate('Accessing the Story Store is deprecated and will be removed in 9.0');
            return this.storyStoreValue[method as keyof StoryStore<TRenderer>];
          }

          throw new StoryStoreAccessedBeforeInitializationError();
        },
      }
    ) as StoryStore<TRenderer>;
  }

  // INITIALIZATION
  protected async initialize() {
    this.setupListeners();

    try {
      const projectAnnotations = await this.getProjectAnnotationsOrRenderError();
      await this.runBeforeAllHook(projectAnnotations);
      await this.initializeWithProjectAnnotations(projectAnnotations);
    } catch (err) {
      this.rejectStoreInitializationPromise(err as Error);
    }
  }

  ready() {
    return this.storeInitializationPromise;
  }

  setupListeners() {
    this.channel.on(STORY_INDEX_INVALIDATED, this.onStoryIndexChanged.bind(this));
    this.channel.on(UPDATE_GLOBALS, this.onUpdateGlobals.bind(this));
    this.channel.on(UPDATE_STORY_ARGS, this.onUpdateArgs.bind(this));
    this.channel.on(ARGTYPES_INFO_REQUEST, this.onRequestArgTypesInfo.bind(this));
    this.channel.on(RESET_STORY_ARGS, this.onResetArgs.bind(this));
    this.channel.on(FORCE_RE_RENDER, this.onForceReRender.bind(this));
    this.channel.on(FORCE_REMOUNT, this.onForceRemount.bind(this));
  }

  async getProjectAnnotationsOrRenderError(): Promise<ProjectAnnotations<TRenderer>> {
    try {
      const projectAnnotations = await this.getProjectAnnotations();

      this.renderToCanvas = projectAnnotations.renderToCanvas;
      if (!this.renderToCanvas) throw new MissingRenderToCanvasError();

      return projectAnnotations;
    } catch (err) {
      // This is an error extracting the projectAnnotations (i.e. evaluating the previewEntries) and
      // needs to be show to the user as a simple error
      this.renderPreviewEntryError('Error reading preview.js:', err as Error);
      throw err;
    }
  }

  // If initialization gets as far as project annotations, this function runs.
  async initializeWithProjectAnnotations(projectAnnotations: ProjectAnnotations<TRenderer>) {
    this.projectAnnotationsBeforeInitialization = projectAnnotations;
    try {
      const storyIndex = await this.getStoryIndexFromServer();
      return this.initializeWithStoryIndex(storyIndex);
    } catch (err) {
      this.renderPreviewEntryError('Error loading story index:', err as Error);
      throw err;
    }
  }

  async runBeforeAllHook(projectAnnotations: ProjectAnnotations<TRenderer>) {
    try {
      await this.beforeAllCleanup?.();
      this.beforeAllCleanup = await projectAnnotations.beforeAll?.();
    } catch (err) {
      this.renderPreviewEntryError('Error in beforeAll hook:', err as Error);
      throw err;
    }
  }

  async getStoryIndexFromServer() {
    const result = await fetch(STORY_INDEX_PATH);
    if (result.status === 200) {
      return result.json() as any as StoryIndex;
    }

    throw new StoryIndexFetchError({ text: await result.text() });
  }

  // If initialization gets as far as the story index, this function runs.
  protected initializeWithStoryIndex(storyIndex: StoryIndex): void {
    if (!this.projectAnnotationsBeforeInitialization)
      // This is a protected method and so shouldn't be called out of order by users
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error('Cannot call initializeWithStoryIndex until project annotations resolve');

    this.storyStoreValue = new StoryStore(
      storyIndex,
      this.importFn,
      this.projectAnnotationsBeforeInitialization
    );
    delete this.projectAnnotationsBeforeInitialization; // to avoid confusion

    this.setInitialGlobals();

    this.resolveStoreInitializationPromise();
  }

  async setInitialGlobals() {
    this.emitGlobals();
  }

  emitGlobals() {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'emitGlobals' });

    const payload: SetGlobalsPayload = {
      globals: this.storyStoreValue.userGlobals.get() || {},
      globalTypes: this.storyStoreValue.projectAnnotations.globalTypes || {},
    };
    this.channel.emit(SET_GLOBALS, payload);
  }

  // EVENT HANDLERS

  // This happens when a config file gets reloaded
  async onGetProjectAnnotationsChanged({
    getProjectAnnotations,
  }: {
    getProjectAnnotations: () => MaybePromise<ProjectAnnotations<TRenderer>>;
  }) {
    delete this.previewEntryError;
    this.getProjectAnnotations = getProjectAnnotations;

    const projectAnnotations = await this.getProjectAnnotationsOrRenderError();
    await this.runBeforeAllHook(projectAnnotations);

    if (!this.storyStoreValue) {
      await this.initializeWithProjectAnnotations(projectAnnotations);
      return;
    }

    this.storyStoreValue.setProjectAnnotations(projectAnnotations);
    this.emitGlobals();
  }

  async onStoryIndexChanged() {
    delete this.previewEntryError;

    // We haven't successfully set project annotations yet,
    // we need to do that before we can do anything else.
    if (!this.storyStoreValue && !this.projectAnnotationsBeforeInitialization) {
      return;
    }

    try {
      const storyIndex = await this.getStoryIndexFromServer();

      // We've been waiting for the index to resolve, now it has, so we can continue
      if (this.projectAnnotationsBeforeInitialization) {
        this.initializeWithStoryIndex(storyIndex);
        return;
      }

      // Update the store with the new stories.
      await this.onStoriesChanged({ storyIndex });
    } catch (err) {
      this.renderPreviewEntryError('Error loading story index:', err as Error);
      throw err;
    }
  }

  // This happens when a glob gets HMR-ed
  async onStoriesChanged({
    importFn,
    storyIndex,
  }: {
    importFn?: ModuleImportFn;
    storyIndex?: StoryIndex;
  }) {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'onStoriesChanged' });
    await this.storyStoreValue.onStoriesChanged({ importFn, storyIndex });
  }

  async onUpdateGlobals({
    globals: updatedGlobals,
    currentStory,
  }: {
    globals: Globals;
    currentStory?: PreparedStory<TRenderer>;
  }) {
    if (!this.storyStoreValue) {
      await this.storeInitializationPromise;
    }
    if (!this.storyStoreValue) {
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'onUpdateGlobals' });
    }

    this.storyStoreValue.userGlobals.update(updatedGlobals);

    if (currentStory) {
      const { initialGlobals, storyGlobals, userGlobals, globals } =
        this.storyStoreValue.getStoryContext(currentStory);
      this.channel.emit(GLOBALS_UPDATED, {
        initialGlobals,
        userGlobals,
        storyGlobals,
        globals,
      } satisfies GlobalsUpdatedPayload);
    } else {
      // If there is no known selected story (e.g. if we are in docs mode), the userGlobals
      // are not overridden.
      const { initialGlobals, globals } = this.storyStoreValue.userGlobals;
      this.channel.emit(GLOBALS_UPDATED, {
        initialGlobals,
        userGlobals: globals,
        storyGlobals: {},
        globals,
      } satisfies GlobalsUpdatedPayload);
    }

    await Promise.all(this.storyRenders.map((r) => r.rerender()));
  }

  async onUpdateArgs({ storyId, updatedArgs }: { storyId: StoryId; updatedArgs: Args }) {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'onUpdateArgs' });
    this.storyStoreValue.args.update(storyId, updatedArgs);

    await Promise.all(
      this.storyRenders
        .filter((r) => r.id === storyId && !r.renderOptions.forceInitialArgs)
        .map((r) =>
          // We only run the play function, with in a force remount.
          // But when mount is destructured, the rendering happens inside of the play function.
          r.story && r.story.usesMount ? r.remount() : r.rerender()
        )
    );

    this.channel.emit(STORY_ARGS_UPDATED, {
      storyId,
      args: this.storyStoreValue.args.get(storyId),
    });
  }

  async onRequestArgTypesInfo({ id, payload }: RequestData<ArgTypesRequestPayload>) {
    try {
      await this.storeInitializationPromise;
      const story = await this.storyStoreValue?.loadStory(payload);
      this.channel.emit(ARGTYPES_INFO_RESPONSE, {
        id,
        success: true,
        payload: { argTypes: story?.argTypes || {} },
        error: null,
      } satisfies ResponseData<ArgTypesResponsePayload>);
    } catch (e: any) {
      this.channel.emit(ARGTYPES_INFO_RESPONSE, {
        id,
        success: false,
        error: e?.message,
      } satisfies ResponseData<ArgTypesResponsePayload>);
    }
  }

  async onResetArgs({ storyId, argNames }: { storyId: string; argNames?: string[] }) {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'onResetArgs' });

    // NOTE: we have to be careful here and avoid await-ing when updating a rendered's args.
    // That's because below in `renderStoryToElement` we have also bound to this event and will
    // render the story in the same tick.
    // However, we can do that safely as the current story is available in `this.storyRenders`
    const render = this.storyRenders.find((r) => r.id === storyId);
    const story = render?.story || (await this.storyStoreValue.loadStory({ storyId }));

    const argNamesToReset = argNames || [
      ...new Set([
        ...Object.keys(story.initialArgs),
        ...Object.keys(this.storyStoreValue.args.get(storyId)),
      ]),
    ];

    const updatedArgs = argNamesToReset.reduce((acc, argName) => {
      acc[argName] = story.initialArgs[argName];
      return acc;
    }, {} as Partial<Args>);

    await this.onUpdateArgs({ storyId, updatedArgs });
  }

  // ForceReRender does not include a story id, so we simply must
  // re-render all stories in case they are relevant
  async onForceReRender() {
    await Promise.all(this.storyRenders.map((r) => r.rerender()));
  }

  async onForceRemount({ storyId }: { storyId: StoryId }) {
    await Promise.all(this.storyRenders.filter((r) => r.id === storyId).map((r) => r.remount()));
  }

  // Used by docs to render a story to a given element
  // Note this short-circuits the `prepare()` phase of the StoryRender,
  // main to be consistent with the previous behaviour. In the future,
  // we will change it to go ahead and load the story, which will end up being
  // "instant", although async.
  renderStoryToElement(
    story: PreparedStory<TRenderer>,
    element: TRenderer['canvasElement'],
    callbacks: RenderContextCallbacks<TRenderer>,
    options: StoryRenderOptions
  ) {
    if (!this.renderToCanvas || !this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({
        methodName: 'renderStoryToElement',
      });

    const render = new StoryRender<TRenderer>(
      this.channel,
      this.storyStoreValue,
      this.renderToCanvas,
      callbacks,
      story.id,
      'docs',
      options,
      story
    );
    render.renderToElement(element);

    this.storyRenders.push(render);

    return async () => {
      await this.teardownRender(render);
    };
  }

  async teardownRender(
    render: StoryRender<TRenderer> | CsfDocsRender<TRenderer> | MdxDocsRender<TRenderer>,
    { viewModeChanged }: { viewModeChanged?: boolean } = {}
  ) {
    this.storyRenders = this.storyRenders.filter((r) => r !== render);
    await render?.teardown?.({ viewModeChanged });
  }

  // API
  async loadStory({ storyId }: { storyId: StoryId }) {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'loadStory' });

    return this.storyStoreValue.loadStory({ storyId });
  }

  getStoryContext(story: PreparedStory<TRenderer>, { forceInitialArgs = false } = {}) {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'getStoryContext' });

    return this.storyStoreValue.getStoryContext(story, { forceInitialArgs });
  }

  async extract(options?: { includeDocsOnly: boolean }) {
    if (!this.storyStoreValue)
      throw new CalledPreviewMethodBeforeInitializationError({ methodName: 'extract' });

    if (this.previewEntryError) throw this.previewEntryError;

    await this.storyStoreValue.cacheAllCSFFiles();

    return this.storyStoreValue.extract(options);
  }

  // UTILITIES

  renderPreviewEntryError(reason: string, err: Error) {
    this.previewEntryError = err;
    logger.error(reason);
    logger.error(err);
    this.channel.emit(CONFIG_ERROR, err);
  }
}
