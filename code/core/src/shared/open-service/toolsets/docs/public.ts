/**
 * Dependency-light entry for the docs toolset (`storybook/internal/toolsets-docs`).
 *
 * `@storybook/mcp` consumes the manifest formatter and toolset from here and bundles this entry
 * into its own dist (core is only a dev dependency there), so everything reachable from this file
 * must stay free of Node-only and server-only imports.
 */

export { getToolName, toMcpToolName } from '../../toolset-names.ts';
export type { ToolsetMethodId } from '../../toolset-names.ts';
export { resolveToolsetDescription } from '../../toolset-definition.ts';
export type { ToolsetCtx, ToolsetOutcome } from '../../toolset-definition.ts';
export { DOCS_TOOLSET_INSTRUCTIONS } from './instructions.ts';
export { emptyManifests } from './access.ts';
export type { DocsAccess, ResolvedDocsEntry } from './access.ts';
export { selectReportedManifests } from './definition.ts';
export { createDocsToolset, isDocsShowError, isDocsShowStoryError } from './definition.ts';
export type {
  CreateDocsToolsetOptions,
  DocsListOutput,
  DocsShowOutput,
  DocsShowStoryOutput,
  DocsToolset,
} from './definition.ts';
export {
  COMPONENT_MANIFEST_PATH,
  createProviderDocsAccess,
  DOCS_MANIFEST_PATH,
  fetchManifests,
  parseManifestRef,
  resolveComponentEntry,
  resolveComponentStories,
  resolveDocEntry,
} from './access-provider.ts';
export type { ManifestProvider, ProviderDocsAccessOptions } from './access-provider.ts';
export { estimateTokens } from '../estimate-tokens.ts';
export { createCompositionDocsSources, listSources } from './multi-source.ts';
export type { CompositionDocsSourcesOptions, DocsSource } from './multi-source.ts';
export {
  formatRequiresOwnMcpNotice,
  getSourceMcpEndpoint,
  ManifestGetError,
  RequiresOwnMcpError,
} from './sources.ts';
export type { RequiresOwnMcpNotice, Source, SourceListing } from './sources.ts';
export {
  adaptCoreComponent,
  adaptCoreDoc,
  adaptCoreStories,
  type CoreDocgenComponent,
} from './manifest-formatter/adapt-core-manifest.ts';
export {
  ComponentManifestMap,
  ComponentManifestMapV0,
  ComponentManifestMapV1,
  DocsManifestMap,
  DocsManifestMapV0,
  DocsManifestMapV1,
  JsonRef,
} from './manifest-formatter/manifest-types.ts';
export {
  extractDocsSummary,
  MAX_SUMMARY_LENGTH,
} from './manifest-formatter/extract-docs-summary.ts';
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
  ManifestError,
  Story,
  SubcomponentManifest,
} from './manifest-formatter/manifest-types.ts';
export {
  formatComponentManifest,
  formatDocsManifest,
  formatManifestsToLists,
  formatStoryDocumentation,
  MAX_STORIES_TO_SHOW,
} from './manifest-formatter/markdown.ts';
export {
  parseReactComponentMeta,
  parseReactDocgen,
  parseReactDocgenTypescript,
  type ParsedDocgen,
} from './manifest-formatter/parse-react-docgen.ts';
