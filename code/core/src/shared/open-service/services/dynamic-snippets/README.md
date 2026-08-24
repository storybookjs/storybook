# Dynamic-snippets open service (`core/dynamic-snippets`)

Args-aware story source for the Docs Source block and manager Code panel. The service is registered
only in the manager and preview when `experimentalDocgenServer` is enabled. It intentionally has no
server registrar and is absent from the server service list, so its state remains within one
browser window's manager-preview channel instead of being relayed between browser sessions.

Consumers create transport-safe query input with `createDynamicSnippetInput(storyId, args, slot)`.
The constructor canonicalizes args once into an `argsKey`. Each story has a `current` slot and an
`initial` slot for Docs blocks rendered with `__forceInitialArgs`; a new args value replaces the
prior value in its slot. The stored input identity prevents a consumer from seeing the previous
value during that replacement. This bounds synchronized state to two records per story.

The query reads its exact record, while its loader compares the relevant `core/story-docs` payload.
A missing record, a changed StoryDocs payload, or a peer snapshot that erased the record invokes the
preview-owned `renderDynamicSnippet` command. The command reads current or initial args from the
preview's StoryStore and uses them only when their `argsKey` matches the query; the key is record
identity, not a lossy substitute for the framework's runtime values. If no matching context exists,
it stores the declared StoryDocs snippet. If StoryDocs cannot load, rendering falls back to
`parameters.docs.source.originalSource`. A warning attached to the StoryDocs snippet travels with
that record, but is omitted when the source falls back to `originalSource`.

The preview `beforeEach` hook calls that public command on every eligible render. This publishes the
record to the manager even when a Source block populated the preview's local query first. With the
exact runtime args it rebuilds the framework template, adds `transformedSource` using the actual
story-view context, and drops transforms superseded by a newer render in the same slot. Transform
failures warn and leave the raw source available. The Docs Source block transforms the raw source
itself with its docs context; the manager Code panel uses the preview-transformed source.

Static builds serialize StoryDocs payloads only. The preview fetches that payload and creates the
dynamic record at runtime.
