# Static build: save and load

A statically-built Storybook serialises each service's state to JSON and re-hydrates it on the client. Per-service opt-out only; the default is "yes, persist."

Two kinds of artifact:

- **`state.json`** — one per service. The full post-setup state. Fetched eagerly on registration and deep-merged into in-memory state.
- **Per-loader files** — emitted only when a service declares loaders. One file per enumerated input. Each contains the Immer patch list that loader produces. Fetched lazily on query subscription, in place of running the loader body.

## Mental model

A service in static-build mode has the same API as a service in dev mode. The runtime hides where the data came from.

Two halves:

- **Build (Node).** A helper takes a service definition (or a pre-mutated runtime) and produces a `Map<filename, value>`. The caller writes those to disk.
- **Load (browser).** One transport is installed at app startup. On every `registerService`, the runtime asks the transport for the service's `state.json` and deep-merges it. On every loader fire, it asks for the loader's per-input file and applies the patches. If the transport returns null, the runtime falls back to live behaviour.

Services never see the transport. They declare relative filenames (`state.json` by convention; loaders via their `path` callback) and the transport composes those into URLs or Map keys.

In tests, both halves run in one process. The "filesystem" is a `Map<string, unknown>`.

## Writing

```ts
import {
  buildServiceArtifacts,
  buildServiceArtifactsFromRuntime,
  STATE_ARTIFACT_NAME, // 'state.json'
} from 'storybook/internal/service';
```

Two forms:

```ts
// From a definition. Constructs a fresh runtime, runs no commands, snapshots
// definition.state. Also iterates loaders and emits per-input files.
const artifacts = await buildServiceArtifacts(DocgenService, { /* registration */ });
```

```ts
// From a runtime you've already mutated. Use this when the build needs to pre-populate
// state by running commands. Emits state.json only — does NOT iterate loaders.
const runtime = new ServiceRuntime(DocgenService, { commands: { generateDocgen: realImpl } });
await runtime.commands.generateDocgen('Button');
await runtime.commands.generateDocgen('Tabs');
const artifacts = buildServiceArtifactsFromRuntime(runtime);
```

Either way, `artifacts` is `Map<filename, value>` of parsed values. Caller serialises:

```ts
for (const [filename, value] of artifacts) {
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(value));
}
```

For a service with loaders, `buildServiceArtifacts` runs each loader-input pair against a fresh sandboxed runtime (so the captured patches are isolated from other loaders) and writes one file per pair. Filename comes from the loader's `path` callback or the default. Example:

```ts
const DocgenService = defineService<DocgenState>()({
  id: 'core/docgen',
  state: { byComponentId: {} },
  queries: { getComponentDocgenInfo: (s, id: string) => s.byComponentId[id] },
  commands: { generateDocgen: defineCommand<string>() },
  load: {
    getComponentDocgenInfo: defineLoader<DocgenState, string>(
      async (id, ctx) => { await ctx.self.commands.generateDocgen(id); },
      async () => listAllComponentIds(),
      { path: (_ctx, id) => `docgen-${id}.json` }
    ),
  },
});

const artifacts = await buildServiceArtifacts(DocgenService, { /* registration */ });
// 'state.json'         — initial state (typically the empty byComponentId)
// 'docgen-Button.json' — [{ op: 'add', path: ['byComponentId', 'Button'], value: {...} }]
// 'docgen-Tabs.json'   — [{ op: 'add', path: ['byComponentId', 'Tabs'],   value: {...} }]
// ...one per enumerated component
```

`buildServiceArtifactsFromRuntime` is the right tool when you've pre-mutated a runtime. It snapshots whatever state the runtime currently holds but skips loader iteration — use `buildServiceArtifacts` when you want the per-loader split.

## Loading

Loading is automatic. Once a transport is installed, every `registerService` fetches `state.json` during construction. Every loader fire consults the transport before running its body.

Install the transport once, at app startup:

```ts
import { setStaticTransport, createBrowserStaticTransport } from 'storybook/internal/service';

if (isStaticBuild) {
  setStaticTransport(createBrowserStaticTransport());
}
```

`createBrowserStaticTransport(baseUrl?)` builds a transport that fetches `${baseUrl}/${serviceId}/${filename}` via `globalThis.fetch`. Default base is `/services`. If `globalThis.fetch` isn't available (non-browser host), every call resolves to null — safe to install unconditionally.

In dev mode, don't install a transport. Without one, `registerService` skips the `state.json` fetch entirely and `store.ready` resolves immediately. Loaders run their bodies live.

Registration code itself doesn't change between modes:

```ts
registerService(DocgenService, {
  commands: { generateDocgen: stubOrSkip },
});
```

`store.ready` resolves when the initial `state.json` load completes. You can await it before reading queries or call queries immediately and accept seeing the default value first, then a notification when the load lands.

`null` from `transport.fetch` is the "no file present" signal. The runtime treats it as a no-op for `state.json` and as fall-through-to-body for loaders. A throw becomes a promise rejection on `store.ready`.

## Loader branching

When a query subscription fires its paired loader, the runtime applies:

1. No transport installed → run the body live.
2. Transport installed → compute the loader's filename and fetch it.
3. Non-null result → `applyPatches` to state. Body is *not* called.
4. Null result → run the body live.

So a service with loaders behaves identically across dev and static deployments — the caller of `queries.foo.subscribe(input, ...)` doesn't know whether the data came from a fresh body run or from a pre-rendered patch file.

Fall-through-on-null matters: a transport need not know about every loader the app might fire. A partial build still works — files that exist are used, files that don't are recomputed live.

## Per-loader files are lazy

The runtime fetches loader files only when their query is subscribed or called. Three guarantees verified by tests:

- After `registerService` + `await ready`, only `state.json` has been fetched. No loader files.
- Subscribing to `queries.foo(input)` triggers exactly one new fetch — the file for *this* loader and *this* input. Other inputs of the same loader are untouched.
- A second subscription for the same input does *not* refetch. The fired-input tracking set suppresses it.

For a docgen service with 1000 enumerated components, browsing only "Button" pulls `state.json` + `docgen-Button.json`. The other 999 files are never requested.

## Opting out

```ts
defineService<S>()({
  id: 'core/example',
  state: { ... },
  load: false,  // no artifacts emitted; no fetch attempted
  queries: { ... },
  commands: { ... },
});
```

`load: false` is enforced both sides: `buildServiceArtifacts` returns an empty Map, and the runtime skips the `state.json` fetch on registration and never tries the per-loader fetch path — bodies always run live. Useful for session-local services (focused panel, scroll position, etc.).

## Deep-merge semantics

When `state.json` is applied, the runtime deep-merges the fetched object into current state inside a `setState` draft:

- Plain objects merge recursively. Keys in the fetched object overwrite; keys not in the fetched object survive.
- Everything else replaces. Primitives, arrays, class instances, null — the fetched value replaces the default. Arrays are not merged element-wise.

This is why state biases toward record-shaped slices (`{ byId: {...} }`) rather than arrays. Records compose under merge; arrays don't.

Immer's structural sharing applies during the merge: untouched nested objects keep reference equality. A subscriber on `state.userPrefs.theme` fires only if the theme key is touched, even if other top-level keys change.

Per-loader files apply via Immer's `applyPatches`, not deep-merge — patches are explicit operations and don't need structural reconciliation.

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

it('loads state.json on registration', async () => {
  const transport = mockTransport();
  transport.files.set(`${MyService.id}/state.json`, { x: 999 });
  setStaticTransport(transport);

  const store = registerService(MyService);
  await store.ready;

  expect(store.queries.get()).toBe(999);
});
```

Full round-trip from `build-artifacts.test.ts`:

```ts
// 1. Build: mutate a runtime, snapshot.
const buildRuntime = new ServiceRuntime(def);
await buildRuntime.commands.add({ id: 'a', name: 'Alice' });
const artifacts = buildServiceArtifactsFromRuntime(buildRuntime);

// 2. Install a transport carrying those artifacts, keyed by `${serviceId}/${filename}`.
const files = new Map<string, unknown>();
for (const [filename, value] of artifacts) {
  files.set(`${def.id}/${filename}`, value);
}
setStaticTransport(mockTransport(files));

// 3. Register fresh; the runtime auto-loads.
const reloaded = registerService(def);
await reloaded.ready;

expect(reloaded.queries.get('a')).toEqual({ name: 'Alice' });
```

`createBrowserStaticTransport` composes the same `${serviceId}/${filename}` key in production and asks `globalThis.fetch` with it.

## Filename ownership

The transport receives `(serviceId, filename)` as separate arguments. The runtime never composes URLs or paths — it passes the pair to whatever transport is installed. The transport decides what those mean. Service authors only ever see relative filenames: `state.json` for the whole-state artifact, and whatever the loader's `path` callback returns for per-loader files.

## State splitting

For services like docgen — where state can be megabytes of per-component data — shipping one big `state.json` blocks first render and wastes bandwidth. Loaders are the chunking mechanism.

A service with loaders gets state split automatically:

- `state.json` carries the initial state plus anything no loader writes to.
- One file per enumerated loader input carries the patches that loader produces.

The rule of thumb: **state-splitting granularity equals loader-input granularity.** A service with no loaders → one `state.json`. A service with a `byId(id)` loader → many small `<id>.json` files plus a small `state.json`. Authors pick by writing loaders shaped how they want the data chunked, and `path` callbacks name the files.
