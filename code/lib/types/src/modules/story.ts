import type {
  Renderer,
  ProjectAnnotations as CsfProjectAnnotations,
  DecoratorFunction,
  LoaderFunction,
  CleanupCallback,
} from '@storybook/csf';

import type {
  ComponentAnnotations,
  ComponentId,
  ComponentTitle,
  LegacyStoryFn,
  PartialStoryFn,
  Path,
  StoryAnnotations,
  StoryContext,
  StoryContextForEnhancers,
  StoryContextForLoaders,
  StoryFn,
  StoryId,
  StoryIdentifier,
  StoryName,
  StrictArgTypes,
  StrictGlobalTypes,
} from './csf';

// Store Types
export interface WebRenderer extends Renderer {
  canvasElement: HTMLElement;
}

export type ModuleExport = any;
export type ModuleExports = Record<string, ModuleExport>;
export type ModuleImportFn = (path: Path) => Promise<ModuleExports>;

type MaybePromise<T> = Promise<T> | T;
export type TeardownRenderToCanvas = () => MaybePromise<void>;
export type RenderToCanvas<TRenderer extends Renderer> = (
  context: RenderContext<TRenderer>,
  element: TRenderer['canvasElement']
) => MaybePromise<void | TeardownRenderToCanvas>;

export type ProjectAnnotations<TRenderer extends Renderer> = CsfProjectAnnotations<TRenderer> & {
  renderToCanvas?: RenderToCanvas<TRenderer>;

  /* @deprecated use renderToCanvas */
  renderToDOM?: RenderToCanvas<TRenderer>;
};

type NamedExportsOrDefault<TExport> = TExport | { default: TExport };

export type NamedOrDefaultProjectAnnotations<TRenderer extends Renderer = Renderer> =
  NamedExportsOrDefault<ProjectAnnotations<TRenderer>>;

export type NormalizedProjectAnnotations<TRenderer extends Renderer = Renderer> = Omit<
  ProjectAnnotations<TRenderer>,
  'decorators' | 'loaders'
> & {
  argTypes?: StrictArgTypes;
  globalTypes?: StrictGlobalTypes;
  decorators?: DecoratorFunction<TRenderer>[];
  loaders?: LoaderFunction<TRenderer>[];
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
  userStoryFn?: StoryFn<TRenderer>;
  decorators?: DecoratorFunction<TRenderer>[];
  loaders?: LoaderFunction<TRenderer>[];
};

export type CSFFile<TRenderer extends Renderer = Renderer> = {
  meta: NormalizedComponentAnnotations<TRenderer>;
  stories: Record<StoryId, NormalizedStoryAnnotations<TRenderer>>;
  moduleExports: ModuleExports;
};

export type PreparedStory<TRenderer extends Renderer = Renderer> =
  StoryContextForEnhancers<TRenderer> & {
    moduleExport: ModuleExport;
    originalStoryFn: StoryFn<TRenderer>;
    undecoratedStoryFn: LegacyStoryFn<TRenderer>;
    unboundStoryFn: LegacyStoryFn<TRenderer>;
    applyLoaders: (
      context: StoryContextForLoaders<TRenderer>
    ) => Promise<StoryContextForLoaders<TRenderer> & { loaded: StoryContext<TRenderer>['loaded'] }>;
    applyBeforeEach: (context: StoryContext<TRenderer>) => Promise<CleanupCallback[]>;
    playFunction?: (context: StoryContext<TRenderer>) => Promise<void> | void;
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

export declare type RenderContext<TRenderer extends Renderer = Renderer> = StoryIdentifier & {
  showMain: () => void;
  showError: (error: { title: string; description: string }) => void;
  showException: (err: Error) => void;
  forceRemount: boolean;
  storyContext: StoryContext<TRenderer>;
  storyFn: PartialStoryFn<TRenderer>;
  unboundStoryFn: LegacyStoryFn<TRenderer>;
};
