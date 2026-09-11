import type { ComponentDoc } from 'react-docgen-typescript';
import type {
  AllManifests,
  ComponentManifest,
  ComponentManifestMap,
  Doc,
  DocsManifestMap,
  Story,
} from 'storybook/internal/toolsets-docs';
import * as v from 'valibot';

/**
 * Represents a single Storybook source (local or remote).
 */
export type Source = {
  /** Unique identifier for this source (e.g., 'local', 'tetra') */
  id: string;
  /** Human-readable title (e.g., 'Local', 'Tetra Design System') */
  title: string;
  /** Remote URL, undefined for local source */
  url?: string;
};

export type RequiresOwnMcpNotice = {
  kind: 'requires-own-mcp';
  endpoint: string;
};

/**
 * All manifests for a single source.
 */
export type SourceManifests = {
  source: Source;
  componentManifest: ComponentManifestMap;
  docsManifest?: DocsManifestMap;
  /** Error message if fetching this source failed */
  error?: string;
  /** Non-error guidance for sources that must be accessed through their own MCP endpoint */
  notice?: RequiresOwnMcpNotice;
};

/**
 * Custom context passed to MCP server and tools.
 * Contains the request object and optional manifest provider.
 */
export type StorybookContext = {
  /**
   * The incoming HTTP request being processed.
   */
  request?: Request;
  /**
   * Optional function to provide custom manifest retrieval logic.
   * If provided, this function will be called instead of the default fetch-based provider.
   * The function receives the request object, a path to the manifest file, and optionally
   * a source (in multi-source mode).
   * The default provider requires a request object and constructs the manifest URL from the request origin,
   * using the top-level manifest path such as /manifests/components.json.
   * Custom providers can use the request parameter to determine the manifest source, or ignore it entirely.
   */
  manifestProvider?: (
    request: Request | undefined,
    path: string,
    source?: Source
  ) => Promise<string>;
  /**
   * Sources configuration for multi-source mode.
   * When provided, tools will fetch and display manifests grouped by source.
   */
  sources?: Source[];
  /**
   * Optional handler called when the docs-list tool is invoked.
   * Receives the context and the component manifest.
   */
  onListAllDocumentation?: (params: {
    context: StorybookContext;
    manifests: AllManifests;
    resultText: string;
    /** Present in multi-source mode — all source manifests including errors */
    sources?: SourceManifests[];
  }) => void | Promise<void>;
  /**
   * Optional handler called when the docs-show tool is invoked.
   * Receives the context, input parameters, and the found component (if any).
   */
  onGetDocumentation?: (
    params: {
      context: StorybookContext;
      input: { id: string; storybookId?: string };
    } & (
      | { foundDocumentation: ComponentManifest | Doc; resultText: string }
      | { foundDocumentation?: never; resultText?: never }
    )
  ) => void | Promise<void>;
  /**
   * Optional in-process resolver for a single component or docs entry, used in
   * Storybook's dev server when `experimentalDocgenServer` is enabled. When set,
   * single-entry tools (`docs-show`, `docs-show-story`) call
   * this instead of fetching the (potentially all-component) manifest index, so a
   * single lookup never triggers docgen extraction for every component.
   *
   * Returns the fully-resolved component or doc in `@storybook/mcp`'s internal
   * shape (already adapted from the open-service payloads), or `undefined` when the
   * id is unknown.
   */
  resolveEntry?: (id: string, source?: Source) => Promise<ResolvedEntry | undefined>;
};

/**
 * Result of resolving a single id via {@link StorybookContext.resolveEntry}: either a
 * fully-resolved component manifest or a standalone docs entry.
 */
export type ResolvedEntry =
  | { kind: 'component'; component: ComponentManifest }
  | { kind: 'doc'; doc: Doc };

/**
 * The manifest schemas come from Storybook's shared docs toolset, which this package bundles, so a
 * hosted Storybook and a dev server validate the same wire format rather than two copies of it.
 * They are re-exported here because embedders import them from this package's root.
 */
export {
  ComponentManifestMap,
  ComponentManifestMapV0,
  ComponentManifestMapV1,
  DocsManifestMap,
  DocsManifestMapV0,
  DocsManifestMapV1,
  JsonRef,
} from 'storybook/internal/toolsets-docs';
export type {
  AllManifests,
  ComponentManifest,
  ComponentManifestEntry,
  ComponentManifestV0,
  ComponentManifestV1,
  Doc,
  DocEntry,
  DocV0,
  DocV1,
  Story,
  SubcomponentManifest,
} from 'storybook/internal/toolsets-docs';

/** Component documentation from react-docgen-typescript, extended with export name. */
export type ComponentDocWithExportName = ComponentDoc & { exportName: string };

/**
 * Open-service payload contracts (the "core format") that Storybook's
 * `experimentalDocgenServer` mode produces. `@storybook/mcp` adapts these into its
 * internal {@link ComponentManifest}/{@link Doc} shapes in one place
 * (`adaptCoreComponent`/`adaptCoreDoc`). Defined structurally (not as schemas) so
 * the addon can build them in-process without importing Storybook core.
 */

/** One story snippet from the `core/story-docs` service. */
export type CoreStoryDoc = {
  id: string;
  name: string;
  snippet?: string;
  description?: string;
  summary?: string;
  error?: { name: string; message: string };
};

/** One MDX doc from the `addon-docs/mdx` service. */
export type CoreMdxDoc = {
  id: string;
  name: string;
  path?: string;
  title?: string;
  content?: string;
  summary?: string;
  error?: { name: string; message: string };
};

/**
 * Payload returned by the `addon-docs/mdx` service for a component or standalone
 * docs entry.
 */
export type CoreMdxPayload = {
  id: string;
  name: string;
  docs: Record<string, CoreMdxDoc>;
};

/** Payload returned by the `core/story-docs` service for one component. */
export type CoreStoryDocsPayload = {
  id: string;
  name: string;
  path: string;
  import?: string;
  stories: Record<string, CoreStoryDoc>;
  error?: { name: string; message: string };
};

/**
 * Payload returned by the `core/docgen` service for one component. `argTypes` (a
 * UI-normalized view) is intentionally ignored by the adapter; prop types come
 * from `reactComponentMeta`/`react*` fields.
 */
export type CoreDocgenPayload = {
  id: string;
  name: string;
  path?: string;
  description?: string;
  summary?: string;
  jsDocTags?: Record<string, string[]>;
  import?: string;
  reactComponentMeta?: unknown;
  reactDocgen?: unknown;
  reactDocgenTypescript?: unknown;
  subcomponents?: Record<string, unknown>;
  error?: { name: string; message: string };
  [key: string]: unknown;
};

/**
 * A component assembled from the `core/docgen` payload plus the `core/story-docs`
 * stories and resolved attached MDX docs.
 */
export type CoreDocgenComponent = CoreDocgenPayload & {
  import?: string;
  /** Story snippets, either as a story-docs record or an already-resolved array. */
  stories?: Record<string, CoreStoryDoc> | Story[];
  /** Attached docs keyed by doc id (resolved MDX payloads). */
  docs?: Record<string, CoreMdxDoc>;
};

/**
 * Shared Valibot field for the storybookId input, used in multi-source mode.
 * Reused across tools that support source selection.
 */
export const StorybookIdField = {
  storybookId: v.pipe(
    v.string(),
    v.description(
      'The Storybook source ID (e.g., "local", "tetra"). Required when multiple Storybooks are composed. See docs-list for available sources.'
    )
  ),
};
