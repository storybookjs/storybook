# Story-docs open service (`core/story-docs`)

Per-story snippets, descriptions, and file-level import statements for docs pages, the Code
panel, and the components HTML debugger. Component prop docgen lives in the sibling `core/docgen`
service.

When `docgenServer` is enabled, the preview `storyDocsSourceBeforeEach` hook emits each story's
snippet via `SNIPPET_RENDERED`, replacing renderer `jsxDecorator` while preserving
`parameters.docs.source.transform` handling in preview. The Code panel shows that emitted snippet
for a story with a `transform`; for any other story it fills the snippet itself (see
[Where the snippet is filled](#where-the-snippet-is-filled)).

## Live snippets

The goal: after you change a control, the snippet shows code you can copy into your project, and
it reads like code you would write. It does not have to be perfect; it has to be logical.

Live snippets are behind `features.experimentalLiveServerSnippets`. While it is off, the service
leaves every `template` out of the story docs, so agents and the components manifest read what they
read before live snippets, and `storyArgsChanged` never reports a change, so every runtime shows the
static snippet.

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
  { kind: 'attrs', spread: true, except: ['label', 'onClick'], text: '' },
  ' />;',
]
```

The browser only fills in values: `printHole` prints a value for its place, and never reads or
rearranges the code around it. Anything that depends on that code, such as which attributes a
spread writes over, the provider decides when it writes the holes.

A hole reads one `arg`, or, as a `spread` hole, the args a control set, as a spread passes them.
A hole is flat: its `kind` and the renderer's own fields for that place stand next to the fields
core reads, `arg`, `spread`, `text` and `space`. Each renderer types its places as one union, which
its provider and its `printHole` share. Core owns only the contract, in `snippetTemplate.ts`, and
never reads a place's fields but its `kind`:

- An arg that holds its initial value (deep-equal) prints the hole's `text`, so nothing the
  controls did not change moves: an arg written as code, such as `fn()` or `shout`, stays as
  written.
- A changed arg prints what the renderer's `PrintHole`, registered with `registerPrintHole`,
  prints for the hole's place and the value. It never sees the code around the hole. A cleared arg
  prints what it prints for `undefined`, such as nothing for an attribute.
- A `spread` hole gets every arg a control set, and the renderer prints those its place does not
  print already. Project-level args, actions Storybook adds and args the server could not resolve
  show only once a control changes them.
- A hole's `space`, such as the whitespace before an attribute, is printed before the renderer's
  print unless that is empty; `withHoleSpace` moves the whitespace before the holes a provider
  names into them, so a cleared attribute leaves no gap.
- A renderer throws an `UnprintableArgError` for a value it cannot print, and the static snippet
  is shown with a warning that names the arg. Once the args change, a story with no template
  shows its static snippet with a warning that it does not follow them.

`stripHoles(template)`, every segment joined with each hole's `text`, is the snippet. The service
drops a template that does not have a template's shape or does not print its snippet. A renderer's
`printHole` prints a value with its `snippet-values.ts`, the module its provider prints the static
snippet with too.

A provider usually prints the snippet a second time with each place an arg prints marked, through
`createHoleMarks`, and turns the marks into holes. Marks are written with private-use characters the
snippet does not hold, so no code as written is read as a mark. `formatTemplate` writes a template
as one string, `⟦kind arg field=value… ~space⟫text⟧`, for test snapshots only.

The Code panel, Canvas › Show code and the `Source` block show the static `snippet` while a story
has the args it is written with, and fill the template once the args change, in dev and in static
builds alike. The `warning` says what the snippet leaves out, which the filled snippet leaves out
too, so it is shown with either.

A story's `template` is stored next to its `snippet`, in the same story docs, so the preview has
it as soon as the story docs load. With the flag on, agents and the components manifest read it too.

### Where the snippet is filled

The `liveSnippet` query fills one story's template with the args that changed, and returns
`{ snippet, warning }`. Its input is a change set: `args` holds only the args that differ from those
the story is written with, and `unset` names the args the story no longer has. Every other arg keeps
its text from the static snippet. The manager, the preview and the docs blocks compute the change
set with `argChanges` from `storybook/internal/docs-tools`, which compares by value and counts an arg
set to `undefined` as unset. With no change, the query returns the static snippet. It runs in every runtime: the server, the manager and the preview each
register `core/story-docs`, and each fills with the `PrintHole` registered in that runtime. It has
no load of its own, so a new `args` input never extracts the story docs again; its `.loaded()`
loads them through the `storyDocs` query it reads.

A renderer gets its printer into each runtime with one module that calls `registerPrintHole` when
imported, named by `printHole` on its `experimental_storyDocsProvider`, next to the `extract` that
writes the templates it prints. With
`features.experimentalLiveServerSnippets` on, core imports that module on the server and adds it to
the `managerEntries`. In the preview the renderer imports it from its own preview annotations: with
CSF factories, builders import only the project's preview file, so a module core added through the
`previewAnnotations` preset would not load. The registry is on `globalThis`, since the manager
bundles the module with its own copy of `storybook/internal/docs-tools`.

- **Code panel:** fills in the manager with the change set of the manager's `args` and
  `initialArgs`, which the preview sends through the channel. The channel drops functions, so the manager cannot run a
  `parameters.docs.source.transform`, and cannot see a function arg the preview changed. For such a
  story the preview marks its emit `previewOnly`, and the panel shows the emitted snippet.
- **Docs blocks:** Canvas › Show code and `<Source>` fill in the preview.
- **Server:** agents and tools can fill with `liveSnippet`. Its `.loaded()` loads the story docs
  first, which on the server extracts them on every call; to fill more than once, load them once
  with `storyDocs.loaded` and then call `liveSnippet.get`.

The manager loads story docs only for a component it has none of. In dev the server's story docs
sync to the manager, and a load would extract them again; static story docs do not sync, so in a
static build the manager fetches its own. The server's extract command joins an extraction already
running for the same id, so a manager and a preview that load a component at once extract it once.

## Providers

Renderers contribute payloads through the `experimental_storyDocsProvider` preset chain. Its value
is `{ extract, printHole? }`: each preset receives the next provider and returns it with its own
`extract`, which may delegate to the next one, as `{ ...next, extract }`.
A renderer whose snippets depend on its own docgen worker builds that preset with `createWorkerGatedStoryDocsProvider` from `storybook/internal/core-server`.
The helper skips the renderer when its worker is not registered, reads only matching story files, logs a file it cannot read at debug level and hands it to the next provider, and merges its payload over the next provider's.
Vue, Svelte, Web Components and Angular use it; React has no worker gate and keeps its own preset.
Each renderer that emits a `template` also sets `printHole` (see
[Where the snippet is filled](#where-the-snippet-is-filled)).

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
