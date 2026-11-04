import type {
  ArgsStoryFn,
  BaseProjectAnnotations,
  BeforeAll,
  Canvas,
  CleanupCallback,
  ComponentAnnotations,
  ComponentId,
  ComponentTitle,
  DecoratorFunction,
  Globals,
  LegacyStoryFn,
  LoaderFunction,
  PartialStoryFn,
  Path,
  Renderer,
  StepRunner,
  StoryAnnotations,
  StoryContext,
  StoryContextForEnhancers,
  StoryContextForRender,
  StoryId,
  StoryIdentifier,
  StoryName,
  StrictArgTypes,
} from './csf.ts';

// Store Types
export interface WebRenderer extends Renderer {
  canvasElement: HTMLElement;
}

export type ModuleExport = any;
export type ModuleExports = Record<string, ModuleExport>;
export type ModuleImportFn = (path: Path) => Promise<ModuleExports>;
/**
 * The export of a module importer, such as an entry of builder-vite's
 * `experimental_moduleImporters`. It returns the module the preview uses for `importPath`, the path
 * as in the story index (for the preview file the same form, e.g. `./.storybook/preview.ts`).
 *
 * - `importFn` imports the file through the importers before this one, and then from the build. An
 *   importer need not call it: a Storybook built once can render story files that exist only at
 *   runtime, which the importer fetches itself. For a path the build doesn't have, `importFn`
 *   rejects; for the preview file it only imports the preview file.
 * - Return the same object for the same module. The store caches by it, so a new object on every
 *   call processes the file again and remounts its story. A docs file (MDX) refers to a story file
 *   with the module it imports itself, so for a story file that MDX refers to, return what
 *   `importFn` returns.
 * - With CSF Next, a story file imports the preview itself and its stories use that preview. An
 *   importer that replaces the preview file also returns story files whose meta uses it.
 * - It is asked again after an HMR update.
 */
export type ImportModule = (
  importPath: Path,
  importFn: ModuleImportFn
) => ModuleExports | Promise<ModuleExports>;

type MaybePromise<T> = Promise<T> | T;
export type TeardownRenderToCanvas = () => MaybePromise<void>;
export type RenderToCanvas<TRenderer extends Renderer> = (
  context: RenderContext<TRenderer>,
  element: TRenderer['canvasElement']
) => MaybePromise<void | TeardownRenderToCanvas>;

export interface ProjectAnnotations<
  TRenderer extends Renderer,
> extends BaseProjectAnnotations<TRenderer> {
  testingLibraryRender?: (...args: never[]) => { unmount: () => void };
  renderToCanvas?: RenderToCanvas<TRenderer>;
}

type NamedExportsOrDefault<TExport> = TExport | { default: TExport };

export type NamedOrDefaultProjectAnnotations<TRenderer extends Renderer = Renderer> =
  NamedExportsOrDefault<ProjectAnnotations<TRenderer>>;

export type NormalizedProjectAnnotations<TRenderer extends Renderer = Renderer> = Omit<
  ProjectAnnotations<TRenderer>,
  'decorators' | 'loaders' | 'runStep' | 'beforeAll'
> & {
  argTypes?: StrictArgTypes;
  decorators?: DecoratorFunction<TRenderer>[];
  loaders?: LoaderFunction<TRenderer>[];
  runStep: StepRunner<TRenderer>;
  beforeAll: BeforeAll;
};

export type NormalizedComponentAnnotations<TRenderer extends Renderer = Renderer> = Omit<
  ComponentAnnotations<TRenderer>,
  'decorators' | 'loaders'
> & {
  // Useful to guarantee that id & title exists
  id: ComponentId;
  title: ComponentTitle;
  argTypes?: StrictArgTypes;
  decorators?: DecoratorFunction<TRenderer>[];
  loaders?: LoaderFunction<TRenderer>[];
};

export type NormalizedStoryAnnotations<TRenderer extends Renderer = Renderer> = Omit<
  StoryAnnotations<TRenderer>,
  'storyName' | 'story' | 'decorators' | 'loaders'
> & {
  moduleExport: ModuleExport;
  // You cannot actually set id on story annotations, but we normalize it to be there for convenience
  id: StoryId;
  argTypes?: StrictArgTypes;
  name: StoryName;
  userStoryFn?: ArgsStoryFn<TRenderer>;
  decorators?: DecoratorFunction<TRenderer>[];
  loaders?: LoaderFunction<TRenderer>[];
};

export type CSFFile<TRenderer extends Renderer = Renderer> = {
  meta: NormalizedComponentAnnotations<TRenderer>;
  stories: Record<StoryId, NormalizedStoryAnnotations<TRenderer>>;
  projectAnnotations?: NormalizedProjectAnnotations<TRenderer>;
  moduleExports: ModuleExports;
};

export type PreparedStory<TRenderer extends Renderer = Renderer> =
  StoryContextForEnhancers<TRenderer> & {
    moduleExport: ModuleExport;
    originalStoryFn: ArgsStoryFn<TRenderer>;
    undecoratedStoryFn: LegacyStoryFn<TRenderer>;
    unboundStoryFn: LegacyStoryFn<TRenderer>;
    applyLoaders: (context: StoryContext<TRenderer>) => Promise<StoryContext<TRenderer>['loaded']>;
    applyBeforeEach: (context: StoryContext<TRenderer>) => Promise<CleanupCallback[]>;
    applyAfterEach: (context: StoryContext<TRenderer>) => Promise<void>;
    playFunction?: (context: StoryContext<TRenderer>) => Promise<void> | void;
    runStep: StepRunner<TRenderer>;
    mount: (context: StoryContext<TRenderer>) => () => Promise<Canvas>;
    testingLibraryRender?: (...args: never[]) => unknown;
    renderToCanvas?: ProjectAnnotations<TRenderer>['renderToCanvas'];
    usesMount: boolean;
    storyGlobals: Globals;
  };

export type PreparedMeta<TRenderer extends Renderer = Renderer> = Omit<
  StoryContextForEnhancers<TRenderer>,
  'name' | 'story'
> & {
  moduleExport: ModuleExport;
};

export type BoundStory<TRenderer extends Renderer = Renderer> = PreparedStory<TRenderer> & {
  storyFn: PartialStoryFn<TRenderer>;
};

// TODO Consolidate this with context for 9.0
export declare type RenderContext<TRenderer extends Renderer = Renderer> = StoryIdentifier & {
  showMain: () => void;
  showError: (error: { title: string; description: string }) => void;
  showException: (err: Error) => void;
  forceRemount: boolean;
  storyContext: StoryContextForRender<TRenderer>;
  storyFn: PartialStoryFn<TRenderer>;
  unboundStoryFn: LegacyStoryFn<TRenderer>;
};
