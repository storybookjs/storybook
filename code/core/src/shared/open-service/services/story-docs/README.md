# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `docgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits each story's
snippet to the manager Code panel and the docs blocks via `SNIPPET_RENDERED`, replacing renderer
`jsxDecorator` while preserving `parameters.docs.source.transform` handling in preview.

## Live snippets

A story's `snippet` is static: it shows the args written in the story file, and it is what agents
and the components manifest read. So that the snippet follows the controls, a provider can also
emit a `template`: the same story as written, with a hole wherever it reads an arg. The provider
knows what each arg reference is, so it marks it. A story that renders
`args.loading ? <Spinner /> : <Button {...args} />` has this template:

```tsx
⟦value loading⟧ ? <Spinner /> : <Button ⟦props⟧ />
```

The renderer fills the holes in the browser with the current args through
`parameters.docs.source.fillTemplate`, a `FillSnippetTemplate` from `storybook/internal/docs-tools`,
where `snippetTemplate.ts` lists the hole kinds. Everything between the holes stays as written,
including its layout, so with `{ loading: false, label: "Go" }` it fills to
`false ? <Spinner /> : <Button loading={false} label="Go" />`. A hole that prints nothing, such as
an unset attribute, takes the whitespace before it along.

The Code panel, Canvas › Show code and the `Source` block show the static `snippet` while a story
has the args it is written with, and fill the template once the args change, in dev and in static
builds alike. The story docs load once per version of a story, and the server keeps them current, so
an args change makes no request. A provider sets `template` only for a story whose every arg
reference is a hole, and a filler throws for a value it cannot print; a missing template, a missing
filler or a filler that throws falls back to the static `snippet`.

## Providers

Renderers contribute payloads through the `experimental_storyDocsProvider` preset chain.
A renderer whose snippets depend on its own docgen worker builds that preset with `createWorkerGatedStoryDocsProvider` from `storybook/internal/core-server`.
The helper skips the renderer when its worker is not registered, reads only matching story files, logs a file it cannot read at debug level and hands it to the next provider, and merges its payload over the next provider's.
Vue, Svelte and Web Components use it; React and Angular have no worker gate and keep their own presets.
Each renderer that emits a `template` sets the matching `fillTemplate` in its `entry-preview-docs`.

## Components spread over several story files

CSF files that share a `title` share a component id. The service extracts each of those files
once and returns their stories in one payload, in story-index order. `id`, `name`, and `path` come
from the file the component selection picks, which is also the only file `core/docgen` reads.

`import` describes one file, so such a payload leaves it unset and each snippet and template carries
the import block of its own file. A file whose extraction throws keeps its stories in the payload, each with
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
