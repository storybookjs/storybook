# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `docgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits each story's
snippet to the manager Code panel and the docs blocks via `SNIPPET_RENDERED`, replacing renderer
`jsxDecorator` while preserving `parameters.docs.source.transform` handling in preview.

## Live snippets

A story's `snippet` is static: it shows the args written in the story file, and it is what agents
and the components manifest read. So that the snippet follows the controls with `docgenServer` on,
a provider also emits a `template`: the same snippet with each place an arg prints wrapped in a
hole that holds what the snippet prints there. For a React story `Primary` with
`args: { label: 'Go', onClick: fn() }` and `render: (args) => <Button {...args} />`:

```tsx
// snippet
const Primary = () => <Button label="Go" onClick={fn()} />;
// template
const Primary = () => <Button⟦attr label label ~%20⟫label="Go"⟧⟦attr onClick onClick ~%20⟫onClick={fn()}⟧⟦attrs * label onClick children⟫⟧⟦close children Button⟫ />⟧;
```

A hole is `⟦kind arg word…⟫text⟧`. `text` is what the snippet prints in that place, `arg` the arg
the place reads, or `*` for the args a control set, as a spread passes them, and `kind` and the
other words are the renderer's. Core owns only this contract, in `snippetTemplate.ts`:

- An arg that holds its initial value (deep-equal) prints the hole's `text`, so nothing the
  controls did not change moves: an arg written as code, such as `fn()` or `shout`, stays as
  written.
- A changed arg prints what the renderer's `PrintHole`, set as `parameters.docs.source.printHole`,
  prints for the hole and the value. A cleared arg prints what it prints for `undefined`, such as
  nothing for an attribute.
- A `*` hole gets every arg a control set, and the renderer prints those its place does not print
  already, which the hole's words name. Project-level args, actions
  Storybook adds and args the server could not resolve show only once a control changes them.
- A `~space` word is text, such as the whitespace before an attribute, printed before the hole's
  print unless that is empty; `withHoleSpace` moves the whitespace before the holes a provider
  names into them.
- A renderer throws an `UnprintableArgError` for a value it cannot print, and the static snippet
  is shown with a warning that names the arg. Once the args change, a story with no template
  shows its static snippet with a warning that it does not follow them.

`stripHoles(template)` is the snippet, which the service checks: it drops a template that does not
print its snippet, or whose snippet holds a hole bracket. Each renderer registers its `printHole`
only with `docgenServer` on, so with it off the parameters do not change. It prints a value with its
`snippet-values.ts`, the module its provider prints the static snippet with too.

The Code panel, Canvas › Show code and the `Source` block show the static `snippet` while a story
has the args it is written with, and fill the template once the args change, in dev and in static
builds alike. The `warning` says what the snippet leaves out, which the filled snippet leaves out
too, so it is shown with either.

### Where templates are stored

A template holds its whole snippet again, so it is kept apart from the story docs, which agents and
the components manifest read:

- One extraction writes the story docs under `state.components` and the templates under
  `state.templates`; the `storyDocs` query never returns a template.
- The `storyTemplates` query returns a component's templates. A static build writes them to
  `core/story-docs/templates/<id>.json`, apart from `core/story-docs/<id>.json`, through the
  `storyDocs` query's `staticSnapshots`, so one extraction fills both files.
- The preview loads a component's templates once, the first time one of its stories renders with
  changed args (`loadStoryTemplates`). A static build fetches the file then; a dev server already
  sent them with the story docs. Until they load, the static snippet shows; if they cannot load, it
  shows with a warning that it does not follow the controls.

So a story whose args never change costs nothing more than its snippet, in the manifest and in the
preview.

## Providers

Renderers contribute payloads through the `experimental_storyDocsProvider` preset chain.
A renderer whose snippets depend on its own docgen worker builds that preset with `createWorkerGatedStoryDocsProvider` from `storybook/internal/core-server`.
The helper skips the renderer when its worker is not registered, reads only matching story files, logs a file it cannot read at debug level and hands it to the next provider, and merges its payload over the next provider's.
Vue, Svelte and Web Components use it; React and Angular have no worker gate and keep their own presets.
Each renderer that emits a `template` sets the matching `printHole` in its preview annotations.

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
