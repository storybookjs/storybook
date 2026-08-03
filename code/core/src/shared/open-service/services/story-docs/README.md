# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `experimentalDocgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits static
snippets to the manager Code panel via `SNIPPET_RENDERED`, replacing renderer `jsxDecorator` while
preserving `parameters.docs.source.transform` handling in preview.

## Import snippets

Story-docs builds file-level `import` statements from CSF import analysis (`getImports`). This
does **not** currently honor the component `@import` JSDoc override tag that the legacy combined
manifest applied after RCM extraction. Imports are derived from resolved import paths and package
name rewriting only. Support for `@import` overrides will return when story-docs can read
component-source JSDoc without coupling to the docgen service.
