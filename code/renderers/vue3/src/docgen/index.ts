/** Internal entry `@storybook/vue3/internal/docgen`: the Vue docgen surface the docgen harness exercises. */
export { extractArgTypes } from '../extractArgTypes.ts';
export { generateSourceCode } from '../docs/sourceDecorator.ts';
export { buildApiDescription } from './component-docgen/api-description/api-description.ts';
export { createNamedTypeDetailResolver } from './component-docgen/arg-types/named-type-detail.ts';
export {
  CHECKER_OPTIONS,
  applyVueDocgenApiTempFixes,
  collectComponentMetaSources,
} from './component-docgen/component-meta/component-meta.ts';
export { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';
