# Static build: save and load

When Storybook is statically built, every service's state can be serialised to JSON at build time and re-hydrated on the client. This is opt-out per service, not opt-in — the default is "yes, persist."

Two kinds of artifacts are emitted:

- **`state.json`** — one per service. Contains the full post-setup state. Loaded eagerly on registration and deep-merged into the in-memory state.
- **Per-loader files** — emitted only when a service declares loaders via the `load:` map. One file per enumerated input of each loader; each file contains the Immer patch list that loader produced. Loaded lazily on query subscription instead of running the loader body.

## Mental model

A service in static-build mode has the same API as a service in live mode. The only difference is that on registration, the runtime fetches the service's persisted artifacts and applies them to state. From the consumer's perspective — calling queries, subscribing to changes, awaiting commands — nothing changes. The runtime hides where the data came from.

There are two halves:

1. **Build side (Node).** A helper takes a service definition (or a runtime that's already been mutated) and produces a `Map<filename, value>` of artifacts to write to disk.
2. **Load side (browser).** A single architecture-global transport is installed once at app startup. Whenever any service registers, the runtime asks that global transport for the service's artifacts, deep-merges them into state, and resolves a `ready` promise.

Services never see or configure the transport themselves. The only thing a service declares is the *relative filename* of each artifact — via the loader's `path` callback, or by accepting the default `state.json` for the whole-state file. How those filenames map to actual URLs, network fetches, or in-memory maps is the transport's job.

In tests, both halves run in the same process. The "filesystem" is just a `Map<string, unknown>`.

## Writing

Every participating service emits at least `state.json` containing the full state object after build-time setup. Services that declare loaders emit additional per-loader-input files.

### Writing

```ts
import {
  buildServiceArtifacts,
  buildServiceArtifactsFromRuntime,
  STATE_ARTIFACT_NAME, // 'state.json'
} from 'storybook/internal/service';
```

Two forms:

```ts
// From a definition. Constructs a fresh runtime, runs no commands, snapshots whatever
// definition.state says. Useful when state is fully defined up-front.
const artifacts = await buildServiceArtifacts(DocgenService);
```

```ts
// From a runtime that's already been mutated. Use this when the build pipeline needs to
// pre-populate state by running commands — e.g. running `generateDocgen` for every
// component before snapshotting.
const runtime = new ServiceRuntime(DocgenService, {
  commands: { generateDocgen: realImpl },
});
await runtime.commands.generateDocgen('Button');
await runtime.commands.generateDocgen('Tabs');
const artifacts = buildServiceArtifactsFromRuntime(runtime);
```

In either case, `artifacts` is a `Map<filename, value>`. The runtime returns parsed values rather than JSON strings; the caller decides how to serialise. A typical static-build step would do:

```ts
for (const [filename, value] of artifacts) {
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(value));
}
```

**For services with loaders**, `buildServiceArtifacts` also emits one file per enumerated input of each loader. Each file contains the Immer patch list that the loader's body produces — captured by running that loader against a fresh sandboxed runtime so its patches are isolated from other loaders. The filename comes from the loader's `path` callback if provided, otherwise a default (`<loaderName>.json` for no-input loaders or `<loaderName>-<input>.json` for string-input loaders; non-string inputs require an explicit `path`).

For the canonical docgen shape:

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
// artifacts contains:
//   'state.json'        — whatever's in state after setup (typically empty byComponentId)
//   'docgen-Button.json' — patches: [{ op: 'add', path: ['byComponentId', 'Button'], value: {...} }]
//   'docgen-Tabs.json'   — patches: [{ op: 'add', path: ['byComponentId', 'Tabs'], value: {...} }]
//   ...one per enumerated component
```

`buildServiceArtifactsFromRuntime(runtime)` only emits `state.json` — it snapshots whatever state the runtime currently holds. Use that when you've pre-mutated a runtime and want the whole-state form. Use `buildServiceArtifacts(def, reg)` when you want the per-loader file split.

### Loading

Loading is automatic and architecture-wide. Once a transport is installed, every subsequent `registerService` call fetches its `state.json` during construction. Service authors don't touch any of this.

**Installing the transport (once, at app startup):**

```ts
import { setStaticTransport, createBrowserStaticTransport } from 'storybook/internal/service';

if (isStaticBuild) {
  setStaticTransport(createBrowserStaticTransport());
}
```

`createBrowserStaticTransport(baseUrl?)` builds a transport that fetches `${baseUrl}/${serviceId}/${filename}` via `globalThis.fetch`. Default base is `/services`. Pass a different base if your deployment serves artifacts from a non-standard path. If `globalThis.fetch` isn't available (non-browser host), the transport's calls resolve to null, so it's safe to install unconditionally.

In dev mode (or in tests that don't care about static artifacts), simply *don't* install a transport. Without one, `registerService` skips the fetch entirely; `store.ready` resolves immediately.

**Registration is unchanged.** Services don't declare anything about the transport. They register the way they always do:

```ts
registerService(DocgenService, {
  commands: { generateDocgen: stubOrSkip },
});
```

If a transport is installed, the runtime fetches `state.json` automatically and deep-merges the result into the in-memory state. The `store.ready` promise resolves when this initial load completes. Consumers can `await store.ready` before reading queries if they want to wait, or call queries immediately and accept seeing the in-memory default first and then a notification once the load completes.

`null` from `transport.fetch` is the explicit "no file present" signal. The runtime treats it as a no-op (keeps the in-memory default). A throw propagates as a promise rejection on `store.ready`.

### Loader fetch-first behavior

The same mechanism extends to loaders. When a query subscription fires its paired loader, the runtime checks:

1. Is a transport installed? If not, run the loader body live.
2. If yes, compute the loader's filename (via `path(ctx, input)` or the default), fetch it from the transport.
3. On a non-null hit, apply the fetched patches via Immer's `applyPatches`. State updates; subscribers fire; loader body is *not* called.
4. On null, fall through to running the loader body live. Same outcome as no transport.

So a service with loaders behaves identically across dev and static deployments — the consumer of a query subscription doesn't care whether the data came from a fresh body run or from a pre-rendered patch file. The runtime hides the difference.

The fall-through-on-null rule is important: it means a transport doesn't have to know about every loader the app might fire. If a build doesn't include a file for some loader-input combo, the runtime gracefully runs that loader live. Useful during incremental rollouts of phase 2 — services can opt some loaders into static loading by providing a `path` callback, and the rest just run live.

### Opting out per service

A service can opt out of the load (and the corresponding write) entirely:

```ts
defineService<S>()({
  id: 'core/example',
  state: { ... },
  load: false,  // no artifacts emitted; runtime never attempts a fetch
  queries: { ... },
  commands: { ... },
});
```

This is enforced on both sides:

- `buildServiceArtifacts` returns an empty Map (no `state.json`, no loader files).
- The runtime skips the `state.json` fetch on registration AND skips fetch-first for any loaders — bodies always run live.

Why opt out? Services whose state is intentionally session-local — e.g. a service holding the currently-focused panel — have nothing meaningful to persist. Future versions may also allow opting individual state slices out (only persist some keys), but for now the granularity is per-service.

## Deep-merge semantics

When `state.json` is applied to state, the runtime deep-merges the fetched object into the current state inside a `setState` draft. The rules:

- **Plain objects merge recursively.** If both target and source have an object at the same key, the values are merged. Keys in the fetched object overwrite the same key in the default; keys not in the fetched object survive.
- **Everything else replaces.** Primitives, arrays, class instances, null — the fetched value replaces the default. Arrays are not merged element-wise; the whole array is replaced.

This is why the architecture biases toward record-shaped state (`{ byId: {...} }`) rather than arrays. Records compose under merge; arrays don't.

Immer's structural sharing applies during the merge, so untouched nested objects retain reference equality with their pre-merge versions. The result is that a query subscriber on `state.userPrefs.theme` only fires if the theme key is touched by the merge — even if other top-level keys change.

## The mock transport pattern

For tests, the transport is a `Map<key, value>` keyed by `${serviceId}/${filename}` — matching what `transport.fetch(serviceId, filename)` receives:

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

Install it via `setStaticTransport` in `beforeEach`, clear it in `afterEach`:

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

The full round-trip pattern, lifted from `build-artifacts.test.ts`:

```ts
// 1. Build: mutate a runtime, snapshot.
const buildRuntime = new ServiceRuntime(def);
await buildRuntime.commands.add({ id: 'a', name: 'Alice' });
await buildRuntime.commands.add({ id: 'b', name: 'Bob' });
const artifacts = buildServiceArtifactsFromRuntime(buildRuntime);

// 2. Install a transport carrying those artifacts (keyed by `${serviceId}/${filename}`).
const files = new Map<string, unknown>();
for (const [filename, value] of artifacts) {
  files.set(`${def.id}/${filename}`, value);
}
setStaticTransport(mockTransport(files));

// 3. Register fresh; the runtime auto-loads from the installed transport.
const reloaded = registerService(def);
await reloaded.ready;

// 4. Assert state matches what was built.
expect(reloaded.queries.get('a')).toEqual({ name: 'Alice' });
```

The `Map<key, value>` is the test-time stand-in for the filesystem. Production transports (`createBrowserStaticTransport`) compose the same key from `serviceId` and `filename` and hand it to `globalThis.fetch`.

## Where filenames live

The transport receives `(serviceId, filename)` as separate arguments. The runtime never composes a URL or a path; it just passes the pair to whatever transport is installed. That keeps the runtime portable: in production, `createBrowserStaticTransport` composes `${baseUrl}/${serviceId}/${filename}` and asks `fetch`; in tests, the mock composes the same key into its Map. Service authors only ever see relative filenames — `state.json` for the whole-state artifact, and whatever the loader's `path` callback returns for per-loader files.

## State splitting via loaders

For services like docgen — where the state can be megabytes of per-component data — shipping it all in one `state.json` blocks first render and wastes bandwidth on data the user may never look at. The `load:` field is the mechanism for chunking.

A service that declares a loader gets state split automatically:

- `state.json` carries the initial empty state plus anything not produced by a loader (the catch-all).
- One file per enumerated loader input carries the Immer patches that loader produces when run live. Fetched lazily on query subscription.

For docgen, that means `state.json` is small (just `{ byComponentId: {} }` plus any other catch-all fields), and `docgen-Button.json`, `docgen-Tabs.json`, etc. are fetched only when the corresponding components are actually viewed.

The mental model that ties everything together: **state-splitting granularity equals command-input granularity**. A service with a single no-input setup → one big `state.json`. A service with a `loadOne(id)` command, wrapped in a loader → many small `<id>.json` files plus a small `state.json` for the rest. Service authors pick by writing the commands the way they want the data chunked, and the loader's `path` callback names the resulting files.
