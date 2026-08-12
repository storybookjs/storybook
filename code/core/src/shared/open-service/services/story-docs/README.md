# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `experimentalDocgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits static
snippets to the manager Code panel via `SNIPPET_RENDERED`, replacing renderer `jsxDecorator` while
preserving `parameters.docs.source.transform` handling in preview.

## Import snippets

Story-docs builds file-level `import` statements from CSF import analysis, shared across providers
by `buildImportStatements` in `csf-tools`.

The component `@import` JSDoc override tag is honored only where a provider already reads the
component source. The Angular provider owns an analyzer for its snippets, so it passes the tag
through; React and Vue derive imports from resolved import paths and package name rewriting only,
and will honor the tag once story-docs can read component-source JSDoc without coupling to the
docgen service.
