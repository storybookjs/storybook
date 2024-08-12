import type { Channel } from '@storybook/core/channels';

import type { Parameters, Renderer, StoryContext, StoryId, StoryName } from './csf';
import type {
  CSFFile,
  ModuleExport,
  ModuleExports,
  NormalizedProjectAnnotations,
  PreparedMeta,
  PreparedStory,
  RenderContext,
} from './story';

export type RenderContextCallbacks<TRenderer extends Renderer> = Pick<
  RenderContext<TRenderer>,
  'showMain' | 'showError' | 'showException'
>;

export type StoryRenderOptions = {
  autoplay?: boolean;
  forceInitialArgs?: boolean;
};

export type ResolvedModuleExportType = 'component' | 'meta' | 'story';

/**
 * What do we know about an of={} call?
 *
 * Technically, the type names aren't super accurate:
 *   - meta === `CSFFile`
 *   - story === `PreparedStory`
 * But these shorthands capture the idea of what is being talked about
 */
export type ResolvedModuleExportFromType<
  TType extends ResolvedModuleExportType,
  TRenderer extends Renderer = Renderer,
> = TType extends 'component'
  ? {
      type: 'component';
      component: TRenderer['component'];
      projectAnnotations: NormalizedProjectAnnotations<Renderer>;
    }
  : TType extends 'meta'
    ? { type: 'meta'; csfFile: CSFFile<TRenderer>; preparedMeta: PreparedMeta }
    : { type: 'story'; story: PreparedStory<TRenderer> };

export type ResolvedModuleExport<TRenderer extends Renderer = Renderer> = {
  type: ResolvedModuleExportType;
} & (
  | ResolvedModuleExportFromType<'component', TRenderer>
  | ResolvedModuleExportFromType<'meta', TRenderer>
  | ResolvedModuleExportFromType<'story', TRenderer>
);

export interface DocsContextProps<TRenderer extends Renderer = Renderer> {
  /**
   * Register a CSF file that this docs entry uses.
   * Used by the `<Meta of={} />` block to attach, and the `<Story meta={} />` bloc to reference
   */
  referenceMeta: (metaExports: ModuleExports, attach: boolean) => void;

  /**
   * Find a component, meta or story object from the direct export(s) from the CSF file.
   * This is the API that drives the `of={}` syntax.
   */
  resolveOf<TType extends ResolvedModuleExportType>(
    moduleExportOrType: ModuleExport | TType,
    validTypes?: TType[]
  ): ResolvedModuleExportFromType<TType, TRenderer>;

  /**
   * Find a story's id from the name of the story.
   * This is primarily used by the `<Story name={} /> block.
   * Note that the story must be part of the primary CSF file of the docs entry.
   */
  storyIdByName: (storyName: StoryName) => StoryId;
  /**
   * Syncronously find a story by id (if the id is not provided, this will look up the primary
   * story in the CSF file, if such a file exists).
   */
  storyById: (id?: StoryId) => PreparedStory<TRenderer>;
  /**
   * Syncronously find all stories of the component referenced by the CSF file.
   */
  componentStories: () => PreparedStory<TRenderer>[];

  /**
   * Syncronously find all stories by CSF file.
   */
  componentStoriesFromCSFFile: (csfFile: CSFFile<TRenderer>) => PreparedStory<TRenderer>[];

  /**
   * Get the story context of the referenced story.
   */
  getStoryContext: (
    story: PreparedStory<TRenderer>
  ) => Omit<StoryContext<TRenderer>, 'abortSignal' | 'canvasElement' | 'step' | 'context'>;
  /**
   * Asyncronously load an arbitrary story by id.
   */
  loadStory: (id: StoryId) => Promise<PreparedStory<TRenderer>>;

  /**
   * Render a story to a given HTML element and keep it up to date across context changes
   */
  renderStoryToElement: (
    story: PreparedStory<TRenderer>,
    element: HTMLElement,
    callbacks: RenderContextCallbacks<TRenderer>,
    options: StoryRenderOptions
  ) => () => Promise<void>;

  /**
   * Storybook channel -- use for low level event watching/emitting
   */
  channel: Channel;

  /**
   * Project annotations -- can be read to get the project's global annotations
   */
  projectAnnotations: NormalizedProjectAnnotations<TRenderer>;
}

export type DocsRenderFunction<TRenderer extends Renderer> = (
  docsContext: DocsContextProps<TRenderer>,
  docsParameters: Parameters,
  element: HTMLElement
) => Promise<void>;
