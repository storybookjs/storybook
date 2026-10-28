# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `docgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits static
snippets to the manager Code panel via `SNIPPET_RENDERED`, replacing renderer `jsxDecorator` while
preserving `parameters.docs.source.transform` handling in preview.

## Providers

Renderers contribute payloads through the `core:story-docs-provider:extend` Reduce hook, registered from their `<pkg>/node` plugin.

- React, Vue, Svelte and Web Components register it in `renderers/<name>/src/node.ts`.
- Angular registers it from the `@storybook/angular-vite` framework in `frameworks/angular-vite/src/node/index.ts`.

A provider whose snippets depend on its own docgen worker wraps it with `createWorkerGatedStoryDocsProvider`; Node code imports it from `@storybook/core/internal/services`.

- The helper skips the provider when its worker is not registered.
- It reads only matching story files.
- It logs a file it cannot read at debug level and hands it to the next provider.
- It merges its payload over the next provider's.
- Vue, Svelte, Web Components and Angular use it; React has no worker gate.

## Components spread over several story files

CSF files that share a `title` share a component id. The service extracts each of those files
once and returns their stories in one payload, in story-index order. `id`, `name`, and `path` come
from the file the component selection picks, which is also the only file `core/docgen` reads.

`import` describes one file, so such a payload leaves it unset and each snippet carries the import
block of its own file. A file whose extraction throws keeps its stories in the payload, each with
that `error`; a file the provider returns nothing for contributes no stories.

## Import snippets

Story-docs builds import statements from CSF import analysis, shared across providers by
`buildImportStatements` in `csf-tools`.

Where they end up differs by provider. React and Vue set the payload-level `import` field, which
`selectSnippetForStory` prepends to the story snippet. Angular instead emits a self-contained
snippet: its snippet is a host component that already carries its own imports, so prepending a
second import block would produce source that does not parse. New providers should follow Angular
and leave `import` unset; the field stays until React and Vue move over, and goes away with them.

The component `@import` JSDoc override tag is honored only where a provider already reads the
component source. Angular reads it from the docgen payload's JSDoc tags; React and Vue derive
imports from resolved import paths and package name rewriting only.
