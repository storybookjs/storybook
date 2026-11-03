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
a provider also emits a `template`: the same snippet, printed by the same printer, with a hole
wherever that printer writes an arg's value. For a React story `Primary` with
`args: { label: 'Go', onClick: fn() }` and `render: (args) => <Button {...args} />`:

```tsx
// snippet
const Primary = () => <Button label="Go" onClick={fn()} />;
// template
const Primary = () => <Button ⟦props⟧ />;
```

Keep it to these rules:

- The static snippet is the renderer's snippet as it was before templates existed, byte for byte.
- The template is that printer with one switch: where it prints an arg's value, it prints a hole.
  Every bail, order and layout decision is shared by the two prints, so a story gets a template
  exactly where it has a snippet, and the template filled with the story's own args is the snippet.
- An arg the printer drops, such as a listener or a property without an attribute, gets no hole.
- The server decides everything. The browser only fills holes: it does not parse or lay out the
  code around them.
- An arg that still holds the value the story is written with prints the code the snippet prints it
  with, which the provider sends as `argCode`. An arg a control changed prints its value, which is
  plain data.

The renderer fills the holes in the browser with the current args through
`parameters.docs.source.fillTemplate`, a `FillSnippetTemplate` from `storybook/internal/docs-tools`.
It registers it only with `docgenServer` on, so with it off the parameters are next's.
`selectLiveSnippetForStory` passes it the unmapped args, as the static snippet reads them, and each
arg whose value is still its initial value (`===`) and that has `argCode` as a `writtenArg`, which
`printValue` prints as its code.

Core owns only the hole contract, in `snippetTemplate.ts`: how a hole is written (`hole`,
`holeWord`), found (`findHoles`) and replaced (`fillHoles`). A hole is a kind and words, separated by
one space. A word that starts with `%` is the rest of it URI-encoded, so an arg named
`Render header?` is the word `%Render%20header%3F`. A `~` word is the whitespace before the hole,
which `fillHoles` prints before a value that is not empty, so an unset attribute leaves no gap or
empty line. The provider decides which holes take it with `withHoleSpace`. `fillHoles` gives the
filler a hole's kind and words and nothing else, so a filler cannot read the code around a hole.

Each framework owns its kinds and words, documented on its `fill-template.ts`, and prints every
value with one module, its `snippet-values.ts`, which its provider prints the static snippet with
too. `snippetValues.ts` holds JavaScript printing helpers that several fillers share, such as
`printValue`, `writtenArg` and the `?` default word; they are not part of the contract.
`code/lib/docgen-harness/src/fill-template-structure.test.ts` checks each filler against these rules.

The Code panel, Canvas › Show code and the `Source` block show the static `snippet` while a story
has the args it is written with, and fill the template once the args change, in dev and in static
builds alike. The story docs load once per version of a story, so an args change makes no request.
The `warning` says what the snippet leaves out, which the filled snippet leaves out too, so it is
shown with either. A filler throws for a value it cannot print; a missing template, a missing filler
or a filler that throws falls back to the static `snippet`.

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
