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
knows what each arg reference is, so it marks it. A React story `Story` with the render
`(args) => args.loading ? <Spinner /> : <Button {...args} />` has this template:

```tsx
const Story = () => ⟦operand loading⟧ ? <Spinner /> : ⟦element Button⟧;
```

Keep it to these rules:

- The template is the story's code as written. The provider only marks where it reads an arg; it
  never rewrites the code around it, inlines a helper or imitates what a helper or directive does.
  `render: (args) => Button(args)` fills to `Button({ label: "Go" })`. A write to an arg, such as
  `args.count++`, is no read and stays as written.
- Core never runs or imitates a helper either: args a story spreads from a call, as in
  `{ ...makeArgs('Hi') }`, cannot be read, and the snippet warns about them.
- An arg that still holds the value the story is written with prints the code the story writes it
  with. An arg a control changed prints its value, which is plain data. So next to `template` the
  provider emits `argCode`, which `argCode` from `storybook/internal/csf-tools` builds from the
  story's args: the code of every arg but a plain string, number, boolean, `null` or `undefined`,
  such as `shout`, `() => null` or `new FormControl('x')`, as written. Only an `⟦operand⟧` hole puts
  it in parentheses, so `max: MB * 5` read as `args.max.toFixed(0)` fills to `(MB * 5).toFixed(0)`.
- The static snippet is the same template filled with the args the story is written with, so the
  snippet keeps its form when a control changes. `fillStoryTemplate` from
  `storybook/internal/csf-tools` builds it on the server with the renderer's own filler, exactly as
  the browser fills the template while no control has changed, next to `template`, `argCode` and
  `templateWarning`: the provider's warning, or the part of it that still holds once a control
  changes. Where the filler cannot print an arg the story is written with, it returns nothing, and
  the provider prints its snippet as it does for a story without a template.
- The browser only replaces each hole with a value. All decisions are the provider's.

The renderer fills the holes in the browser with the current args through
`parameters.docs.source.fillTemplate`, a `FillSnippetTemplate` from `storybook/internal/docs-tools`,
where `snippetTemplate.ts` lists the hole kinds. `selectLiveSnippetForStory` passes it each arg
whose value is still its initial value (`===`) and that has `argCode` as a `writtenArg`, which
`printValue` prints as its code, so a filler needs nothing of its own for it.

Everything between the holes stays as written, including its layout, so with
`{ loading: false, label: "Go" }` it fills to
`const Story = () => false ? <Spinner /> : <Button loading={false} label="Go" />;`. An attribute
hole (`⟦props⟧`, `⟦attr⟧`, `⟦bool⟧` or `⟦prop⟧`) that prints nothing takes the whitespace before it
along, so an unset attribute leaves no gap or empty line. Any other hole keeps it, as the story
renders it, so `Hello ⟦text name⟧!` fills to `Hello !` while `name` is unset, unless it holds a line
break, where it would leave an empty line.

A hole is a kind and words, separated by one space. A word that starts with `%` is the rest of it
URI-encoded, so an arg named `Render header?` is the word `%Render%20header%3F`. A hole for one arg
may end in a `?` word, the code to print while the arg is unset, also URI-encoded: a story that
renders `({ size = 'md' }) => <Button size={size} />` has the template
`<Button ⟦attr size size ?'md'⟧ />`. `holeWord`, `defaultWord` and `defaultCode` write and read
these words.

Each renderer adds holes and words of its own, which the comment on its `fill-template.ts`
documents, such as React's `⟦element Button⟧` or Vue's `⟦slots Card⟧`. In a React, Vue or Svelte
`⟦props⟧` hole a `-name` word leaves an arg out: one the element writes itself, before or after the
spread, which the snippet shows as written. Angular's `⟦props⟧` instead names the inputs it binds,
and an `=` word before them binds an arg set to `undefined` too.

The Code panel, Canvas › Show code and the `Source` block show the static `snippet` while a story
has the args it is written with, and fill the template once the args change, in dev and in static
builds alike. The story docs load once per version of a story, and the server keeps them current, so
an args change makes no request. Every story with a static snippet and args has a template: the
snippet the renderer prints, with a hole at every place where it fills in an arg, and the static
snippet is that template filled with the story's own args. A provider never writes code into a
template that its snippet does not print. Where a renderer computes something from an arg rather
than printing it, the hole goes where the arg itself is. A story without a static snippet has no
template either. The `warning` belongs to the static snippet: part of it may be about arg
values the source does not show, which the filled snippet has. So a provider also sets
`templateWarning` to what the filled snippet still leaves out, such as the `NgModule` a
`standalone: false` Angular component needs, or a name in the `argCode` of an arg it prints as
written, and the filled snippet is shown with that warning instead; without one it is shown with
none. A filler throws for a value it cannot print; a missing template, a missing filler or a filler
that throws falls back to the static `snippet` and its `warning`.

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
