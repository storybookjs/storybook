# Static build: save and load

A statically-built Storybook serialises service state to JSON at build time and re-hydrates it lazily on the client. Loaders are the only mechanism — a service that doesn't declare loaders doesn't persist anything.

## Mental model

A service in static-build mode has the same API as a service in dev mode. The runtime hides where the data came from.

Two halves:

- **Build (Node).** `buildServiceArtifacts(def, registration?)` iterates the service's declared loaders, runs each enumerated input in a sandboxed runtime, captures the resulting state diff in a JSON-friendly nested-object shape (`{a:{b:1}}`), and returns a `Map<filename, value>`. The caller writes those to disk.
- **Load (browser).** One transport is installed at app startup. When a query subscription fires its paired loader, the runtime asks the transport for the loader's per-input file. On a hit, the fetched diff is deep-merged into state and the loader body is *not* called. On null (no file present), the runtime runs the body live as a fall-through.

Services never see the transport. They declare relative filenames via the loader's `path` callback (or accept the default), and the transport composes those into URLs or Map keys.

In tests, both halves run in one process. The "filesystem" is a `Map<string, unknown>`.

## Two loader shapes

How you structure loaders determines how state is split on disk.

**Per-id chunking.** A loader keyed by an input, enumerated over many ids. One file per id, fetched only when that id is asked about. The docgen pattern:

```ts
load: {
  getComponentDocgenInfo: defineLoader<DocgenState, string>(
    async (id, ctx) => { await ctx.self.commands.generateDocgen(id); },
    async () => listAllComponentIds(),
    { path: (_ctx, id) => `docgen-${id}.json` }
  ),
}
```

**Single-file whole-service load.** A no-input loader (`enumerateInputs: undefined`) that populates the whole state in one go. One file for the service, fetched when any subscriber asks for the matching query. The StoryStatusService pattern:

```ts
load: {
  allStatuses: defineLoader<StatusState, void>(
    async (ctx) => {
      const data = await fetchAllStatusesAtBuildTime();
      ctx.self.setState((d) => { d.byStoryId = data; });
    },
    undefined,
    { path: () => 'statuses.json' }
  ),
}
```

Both shapes use identical machinery. The choice is whether you want one no-input loader or many input-keyed ones.

## Writing

```ts
import { buildServiceArtifacts } from 'storybook/internal/service';

const artifacts = await buildServiceArtifacts(DocgenService, { /* registration */ });
// artifacts is Map<filename, value>:
//   'docgen-Button.json' → { byComponentId: { Button: { description: '...' } } }
//   'docgen-Tabs.json'   → { byComponentId: { Tabs:   { description: '...' } } }
//   ...one per enumerated input of every loader
```

Each loader-input pair runs against a fresh sandboxed runtime so its captured diff is isolated from other loaders. Filename comes from the loader's `path` callback or the default (`<name>.json` for no-input, `<name>-<input>.json` for string inputs; non-string inputs require an explicit `path`).

When multiple loader-input pairs resolve to the same filename, their diffs are deep-merged at build time and written as a single artifact. This makes the "many loaders, one file" pattern natural — useful when several queries share an underlying single-file backing store.

A service with no `load` field returns an empty Map — nothing to write.

The caller serialises:

```ts
for (const [filename, value] of artifacts) {
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(value));
}
```

## Loading

Install the transport once, at app startup:

```ts
import { setStaticTransport, createBrowserStaticTransport } from 'storybook/internal/service';

if (isStaticBuild) {
  setStaticTransport(createBrowserStaticTransport());
}
```

`createBrowserStaticTransport(baseUrl?)` builds a transport that fetches `${baseUrl}/${serviceId}/${filename}` via `globalThis.fetch`. Default base is `/services`. If `globalThis.fetch` isn't available (non-browser host), every call resolves to null — safe to install unconditionally.

In dev mode, don't install a transport. Without one, every loader runs its body live; no fetches are attempted.

Registration code is the same in both modes:

```ts
registerService(DocgenService, {
  commands: { generateDocgen: stubOrSkip },
});
```

Nothing is loaded eagerly. Every loader fetch is lazy, triggered by a query subscription or callable read.

## Loader branching

When a query subscription fires its paired loader, the runtime applies:

1. No transport installed → run the body live.
2. Transport installed → compute the loader's filename and fetch it.
3. Non-null result → deep-merge the fetched diff into state. Body is *not* called.
4. Null result → run the body live.

So a service with loaders behaves identically across dev and static deployments — the caller of `queries.foo.subscribe(input, ...)` doesn't know whether the data came from a fresh body run or a pre-rendered patch file.

Fall-through-on-null matters: a transport need not know about every loader the app might fire. A partial build still works — files that exist are used, files that don't are recomputed live.

## Loader files are lazy

Three guarantees verified by tests:

- Registration triggers no fetches.
- Subscribing to `queries.foo(input)` triggers exactly one fetch — the file for *this* loader and *this* input. Other inputs of the same loader are untouched.
- A second subscription for the same input does *not* refetch. The fired-input tracking set suppresses it.

For a docgen service with 1000 enumerated components, browsing only "Button" pulls `docgen-Button.json` and nothing else. The other 999 files are never requested.

For a single-file service (no-input loader), the file is fetched on first subscription to the loader-backed query — typically immediately after registration when the UI mounts the relevant component.

## State-shaped diffs

Loader files contain JSON-friendly nested-object diffs — the shape of the state slice a loader produced — not Immer patch lists. The runtime applies them via deep-merge. Multiple loaders writing to disjoint state slices (e.g. `byComponentId.Button` and `byComponentId.Tabs`) compose cleanly because their object trees only touch their own paths.

The build still uses Immer's `produceWithPatches` to capture what each loader changed; the patches are converted to a nested object before serialisation so files are inspectable and don't require Immer to read.

Two implications for state shape:

- Bias state toward record-shaped slices (`{ byId: {...} }`) rather than arrays. Records compose under deep-merge; arrays are replaced wholesale (no element-level merging).
- Don't put non-serialisable values in state. Diffs go through `JSON.stringify`.

The build rejects two patch shapes that can't be expressed as a clean state-diff: array-index patches (when a loader mutates array elements directly) and `remove` patches (deletions). Both throw at build time with an actionable error. Loaders should produce data, and collections should be records.

## The mock transport pattern

For tests, the transport is a `Map<key, value>` keyed by `${serviceId}/${filename}`, matching what `transport.fetch(serviceId, filename)` receives:

```ts
function mockTransport(files: Map<string, unknown> = new Map()): ServiceStaticTransport & {
  files: Map<string, unknown>;
} {
  return {
    files,
    fetch: async (serviceId, filename) => {
      const key = `${serviceId}/${filename}`;
      return files.has(key) ? files.get(key) : null;
    },
  };
}
```

Install in `beforeEach`, clear in `afterEach`:

```ts
afterEach(() => clearStaticTransport());

it('reads from a pre-built loader file', async () => {
  const transport = mockTransport();
  transport.files.set(`${MyService.id}/docgen-Button.json`, {
    byComponentId: { Button: { description: '...' } },
  });
  setStaticTransport(transport);

  const store = registerService(MyService);
  const listener = vi.fn();
  store.queries.getComponentDocgenInfo.subscribe('Button', listener);
  await new Promise((r) => setTimeout(r, 0));

  expect(listener).toHaveBeenCalledWith({ description: '...' });
});
```

Full round-trip from `build-artifacts.test.ts`:

```ts
// 1. Build: enumerate inputs, run each in a sandbox, capture patches.
const artifacts = await buildServiceArtifacts(def);

// 2. Install a transport carrying those artifacts, keyed by `${serviceId}/${filename}`.
const files = new Map<string, unknown>();
for (const [filename, value] of artifacts) {
  files.set(`${def.id}/${filename}`, value);
}
setStaticTransport(mockTransport(files));

// 3. Register fresh; subscribing triggers a fetch (not the body), data lands in state.
const reloaded = registerService(def);
reloaded.queries.getOne.subscribe('Button', vi.fn());
await new Promise((r) => setTimeout(r, 0));

expect(reloaded.queries.getOne('Button')).toEqual(/* built value */);
```

`createBrowserStaticTransport` composes the same `${serviceId}/${filename}` key in production and asks `globalThis.fetch` with it.

## Filename ownership

The transport receives `(serviceId, filename)` as separate arguments. The runtime never composes URLs or paths — it passes the pair to whatever transport is installed. The transport decides what those mean. Service authors only ever see relative filenames, controlled by the loader's `path` callback.

## State splitting

For services like docgen — where state can be megabytes of per-component data — shipping one big file blocks first render and wastes bandwidth on data the user may never view. Loaders are the chunking mechanism, and the granularity is set by loader inputs.

**State-splitting granularity equals loader-input granularity.** A no-input loader → one file. An input-keyed loader with N enumerated inputs → N files. Pick by writing loaders shaped how you want the data chunked, and use `path` callbacks to name the files.
