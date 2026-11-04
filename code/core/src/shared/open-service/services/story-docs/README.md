# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `docgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits each story's
snippet to the manager Code panel and the docs blocks via `SNIPPET_RENDERED`, replacing renderer
`jsxDecorator` while preserving `parameters.docs.source.transform` handling in preview.

## Live snippets

The goal: after you change a control, the snippet shows code you can copy into your project, and
it reads like code you would write. It does not have to be perfect; it has to be logical.

A story's `snippet` is static: it shows the args written in the story file, and it is what agents
and the components manifest read. So that the snippet follows the controls with `docgenServer` on,
a provider also emits a `template`: the same snippet split into code and holes, each hole a place an
arg prints with the `text` the snippet prints there. For a React story `Primary` with
`args: { label: 'Go', onClick: fn() }` and `render: (args) => <Button {...args} />`:

```ts
// snippet
'const Primary = () => <Button label="Go" onClick={fn()} />;'
// template
[
  'const Primary = () => <Button',
  { kind: 'attr', arg: 'label', text: ' label="Go"', space: ' ' },
  { kind: 'attr', arg: 'onClick', text: ' onClick={fn()}', space: ' ' },
  { kind: 'attrs', spread: true, except: ['label', 'onClick', 'children'], text: '' },
  { kind: 'close', arg: 'children', element: 'Button', text: ' />' },
  ';',
]
```

A hole reads one `arg`, or, as a `spread` hole, the args a control changed, as a spread passes them.
A hole is flat: its `kind` and the renderer's own fields for that place stand next to the fields
core reads, `arg`, `spread`, `text` and `space`. Each renderer types its places as one union, which
its provider and its `printHole` share. Core owns only the contract, in `snippetTemplate.ts`, and
never reads a place's fields but its `kind`:

- An arg that holds its initial value (deep-equal) prints the hole's `text`, so nothing the
  controls did not change moves: an arg written as code, such as `fn()` or `shout`, stays as
  written.
- A changed arg prints what the renderer's `PrintHole`, set as `parameters.docs.source.printHole`,
  prints for the hole's place and the value. It never sees the code around the hole. A cleared arg
  prints what it prints for `undefined`, such as nothing for an attribute.
- A `spread` hole gets every arg a control changed, a cleared one as `undefined`, and the renderer
  prints those its place does not print already. Project-level args, actions Storybook adds and args
  the server could not resolve show only once a control changes them.
- A hole's `space`, such as the whitespace before an attribute, is printed before the renderer's
  print unless that is empty; `withHoleSpace` moves the whitespace before the holes a provider
  names into them, so a cleared attribute leaves no gap.
- A renderer throws an `UnprintableArgError` for a value it cannot print, and the static snippet
  is shown with a warning that names the arg. Once the args change, a story with no template
  shows its static snippet with a warning that it does not follow them.

`stripHoles(template)`, every segment joined with each hole's `text`, is the snippet. The service
drops a template that does not have a template's shape or does not print its snippet, and the
preview checks it again, as the templates load apart from the story docs. Each renderer registers
its `printHole` only with `docgenServer` on, so with it off the parameters do not change. It prints a
value with its `snippet-values.ts`, the module its provider prints the static snippet with too.

A provider usually prints the snippet a second time with each place an arg prints marked, through
`createHoleMarks`, and turns the marks into holes. Marks are written with private-use characters the
snippet does not hold, so no code as written is read as a mark. `formatTemplate` writes a template
as one string, `⟦kind arg field=value… ~space⟫text⟧`, for test snapshots only.

The Code panel, Canvas › Show code and the `Source` block show the static `snippet` while a story
has the args it is written with, and fill the template once the args change, in dev and in static
builds alike. The `warning` says what the snippet leaves out, which the filled snippet leaves out
too, so it is shown with either.

### Where templates are stored

A template holds its whole snippet again, so it is kept apart from the story docs, which agents and
the components manifest read:

- One extraction writes the story docs under `state.components` and the templates under
  `state.templates`; the `storyDocs` query never returns a template. A filled template gets the
  `import` of the story docs, as its snippet does, so the templates do not repeat it.
- The `storyTemplates` query returns a component's templates. A static build writes them to
  `core/story-docs/templates/<id>.json`, apart from `core/story-docs/<id>.json`, through the
  `storyDocs` query's `staticSnapshots`, so one extraction fills both files.
- The preview loads a component's templates once, the first time one of its stories renders with
  changed args (`loadStoryTemplates`). A static build fetches the file then. A dev server sends them
  over its socket with the story docs, and the `storyTemplates` load joins a story-docs load in
  flight, so it never extracts twice. Until they load, the static snippet shows; if they cannot
  load, it shows with a warning that it does not follow the controls, and the next change tries
  again.
- The `Source` hook reads a story's template in its story-docs selector, so an update that changes
  only a template fills the snippet again without loading the templates.

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
