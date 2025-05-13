import type { ModuleExport, ModuleExports } from 'storybook/internal/types';

type StoryBlockParameters = {
  /** Whether a story's play function runs when shown in docs page */
  autoplay?: boolean;
  /**
   * Set a minimum height (note for an iframe this is the actual height) when rendering a story in
   * an iframe or inline. This overrides `parameters.docs.story.iframeHeight` for iframes.
   */
  height?: string;
  /** IFrame configuration */
  iframeHeight?: string;
  /**
   * Whether the story is rendered inline (in the same browser frame as the other docs content) or
   * in an iframe
   */
  inline?: boolean;
  /** Specifies the CSF file to which the story is associated */
  meta: ModuleExports;
  /**
   * Specifies which story is rendered by the Story block. If no `of` is defined and the MDX file is
   * attached, the primary (first) story will be rendered.
   */
  of: ModuleExport;
};

type ControlsBlockParameters = {
  /** Exclude specific properties from the Controls panel */
  exclude?: string[] | RegExp;

  /** Exclude only specific properties in the Controls panel */
  include?: string[] | RegExp;

  /** Controls sorting order */
  sort?: 'none' | 'alpha' | 'requiredFirst';
};

type ArgTypesBlockParameters = {
  /** Exclude specific arg types from the args table */
  exclude?: string[] | RegExp;

  /** Exclude only specific arg types from the args table */
  include?: string[] | RegExp;

  /**
   * Specifies which story to get the arg types from. If a CSF file exports is provided, it will use
   * the primary (first) story in the file.
   */
  of: ModuleExport | ModuleExports;

  /**
   * Controls arg types order
   *
   * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-argtypes#sort
   */
  sort?: 'none' | 'alpha' | 'requiredFirst';
};

type CanvasBlockParameters = {
  /**
   * Provides any additional custom actions to show in the bottom right corner. These are simple
   * buttons that do anything you specify in the onClick function.
   */
  additionalActions?: {
    className?: string;
    disabled?: boolean;
    onClick: () => void;
    title: string | JSX.Element;
  }[];
  /** Provide HTML class(es) to the preview element, for custom styling. */
  className?: string;
  /**
   * Specify how the canvas should layout the story.
   *
   * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-canvas#layout
   */
  layout?: 'centered' | 'fullscreen' | 'padded';
  /** Specifies which story is rendered */
  of: ModuleExport;
  /** Show story source code */
  sourceState?: 'hidden' | 'shown';
  /**
   * Story configuration
   *
   * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-canvas#story
   */
  story?: StoryBlockParameters;
  /** Disable story source code */
  withSource?: 'open' | 'closed' | 'none';
  /** Whether to render a toolbar containing tools to interact with the story. */
  withToolbar?: 'open' | 'closed' | 'none';
};

type DescriptionBlockParameters = {
  /** Component description */
  component?: string;
  /** Story description */
  story?: string;
};

type SourceBlockParameters = {
  /** The source code to be rendered. Will be inferred if not passed */
  code?: string;
  /** Whether to render the code in dark mode */
  dark?: boolean;
  /** Determines if decorators are rendered in the source code snippet. */
  excludeDecorators?: boolean;
  /**
   * The formatting used on source code. Both true and 'dedent' have the same effect of removing any
   * extraneous indentation. Supports all valid prettier parser names.
   *
   * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-source#format
   */
  format?: boolean | 'dedent' | string;
  // TODO: We could try to extract types from 'SupportedLanguages' in SyntaxHighlihter, but for now we inline them
  /** Source code language */
  language?:
    | 'bash'
    | 'css'
    | 'graphql'
    | 'html'
    | 'json'
    | 'jsextra'
    | 'jsx'
    | 'md'
    | 'text'
    | 'tsx'
    | 'typescript'
    | 'yml';
  /**
   * Specifies which story is rendered by the Source block. If no of is defined and the MDX file is
   * attached, the primary (first) story will be rendered.
   */
  of: ModuleExport;
  /** Source code transformations */
  transform?: (code: string, storyContext: any) => string;
  /**
   * Specifies how the source code is rendered.
   *
   * @default 'auto'
   * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-source#type
   */
  type?: 'auto' | 'code' | 'dynamic';
};

export interface DocsParameters {
  /**
   * Docs configuration
   *
   * @see https://storybook.js.org/docs/writing-docs
   */
  docs?: {
    /**
     * The subtitle displayed when shown in docs page
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-argtypes
     */
    argTypes?: ArgTypesBlockParameters;

    /**
     * Canvas configuration when shown in docs page
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-canvas
     */
    canvas?: CanvasBlockParameters;

    /**
     * Controls block configuration
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-controls
     */
    controls?: ControlsBlockParameters;

    /**
     * Component/story description when shown in docs page
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-description#writing-descriptions
     */
    description?: DescriptionBlockParameters;

    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;

    /**
     * Replace the default documentation template used by Storybook with your own
     *
     * @see https://storybook.js.org/docs/writing-docs/autodocs#write-a-custom-template
     */
    page?: unknown;

    /**
     * Source code configuration when shown in docs page
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-source
     */
    source?: SourceBlockParameters;

    /**
     * Story configuration
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-story
     */
    story?: StoryBlockParameters;

    /**
     * The subtitle displayed when shown in docs page
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-subtitle
     */
    subtitle?: string;

    /**
     * The title displayed when shown in docs page
     *
     * @see https://storybook.js.org/docs/api/doc-blocks/doc-block-title
     */
    title?: string;
  };
}
