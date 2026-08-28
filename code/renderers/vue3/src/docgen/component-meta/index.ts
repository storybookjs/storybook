/**
 * The `vue-component-meta` docgen engine, shared by both Vue docgen paths.
 *
 * The legacy path is the Vite plugin in `@storybook/vue3-vite`, which injects the extracted meta
 * into the preview bundle as `__docgenInfo`. The server path is the docgen worker in
 * `../docgen-worker.ts`, which keeps the meta on the server and ships converted argTypes over the
 * `core/docgen` open service. Both must see identical meta, so all checker setup and normalization
 * lives behind this module rather than in either caller.
 *
 * This is the surface the renderer preset hands to the framework as `experimental_vueDocgenEngine`;
 * everything else in the folder is internal to the engine.
 */
export { createVueComponentMetaChecker } from './checker.ts';
export { collectComponentMetaSources, type MetaSource } from './collect-meta-sources.ts';
