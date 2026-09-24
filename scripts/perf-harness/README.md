# Storybook perf harness

This harness gives before and after numbers for a Storybook change. One command runs one workload
against two builds of Storybook and writes a markdown table that you can paste into a PR.

The harness lives on the `perf-harness` branch only. Do not merge it. It is not a yarn workspace,
and `scripts/.oxlintrc.json` ignores it.

## Set up

Use Node 22.18 or later (the harness uses Node 24 in its baselines).

```sh
cd scripts/perf-harness
npm install
npx playwright install chromium
```

## Pick the two builds

`--before` and `--after` each take a build ref:

| Ref | Meaning |
| --- | --- |
| `local:<path>` | A compiled checkout of storybookjs/storybook. This is the main option. |
| `canary:<sha>` | The pkg.pr.new canaries of storybookjs/storybook at `<sha>`. Use this when you cannot compile locally. |

To compile a checkout, run this in the checkout:

```sh
yarn
yarn nx run-many -t compile -c production
```

This is the same compile that the canary workflow runs (`yarn task --task compile --start-from=auto`).
Compile again after every code change. The harness does not look at `dist/`.

For a local build, the harness packs every public workspace with `yarn pack` (which rewrites
`workspace:` ranges to versions) into `~/.cache/storybook-perf-harness/builds/<key>/`. The key is the
git tree of `code/` plus a hash of uncommitted changes under `code/`. When the key does not change,
the harness uses the tarballs again. When you compile again without a code change, delete the
folder to pack again.

Projects install the tarballs as `file:` dependencies. Every Storybook package in the project also
gets an override (`overrides` for npm, `resolutions` for yarn), so the project has one copy of each.

Use two checkouts for a PR, for example a worktree of `next` and a worktree of the PR branch. A
build is a checkout, so `before` and `after` can also be the same checkout (a sanity check: every
ratio must be near 1.00).

## Run a workload

Each workload is one command. Run it from `scripts/perf-harness`. `--runs` defaults to 3.

```sh
# Status flood on a synthetic project (sizes: any; shapes: balanced, wide)
node bench.mjs status-flood --before local:../next --after local:../pr --size 10000 --shape wide

# Browse and search on the Chromatic webapp (or --project synthetic)
node bench.mjs browse-search --before local:../next --after local:../pr

# Full addon-vitest run on the Chromatic webapp
node bench.mjs vitest-run --before local:../next --after local:../pr

# The SB-2057 docgen sync session (synthetic docgen project, 2000 components)
node bench.mjs docgen --before local:../next --after local:../pr
```

The runs alternate: before, after, after, before, and so on. So slow drift on the machine affects
both sides the same. Every run starts cold: the harness deletes the Storybook and Vite caches of the
project first.

The harness writes to `results/<workload>-<project>-<time>/` (or `--out <dir>`):
`report.md`, `summary.json`, `meta.json`, and the raw JSON and server log of each run.

### Common options

| Option | Default | Meaning |
| --- | --- | --- |
| `--runs <n>` | 3 | Runs per build. The report shows the median. |
| `--project <name>` | per workload | `synthetic` or `chromatic`. |
| `--size <n>` | 5000 | Synthetic only: index entries (stories). `docgen` shape: components. |
| `--shape <name>` | `balanced` | Synthetic only: `balanced`, `wide`, or `docgen`. |
| `--out <dir>` | `results/…` | Results folder. |
| `--port <n>` | 6106 | Dev server port. The harness also uses `<port>+1000` and `<port>+1001`. |
| `--work-dir <dir>` | `~/.cache/storybook-perf-harness` | Tarballs and synthetic projects. |
| `--chromatic <dir>` | `~/dev/chromaui/chromatic` | Chromatic checkout. The harness does not change it. |
| `--chromatic-ref <sha>` | pinned | Chromatic commit to test. |
| `--prepare-only` | off | Pack and install, then stop. |

### Workload options

| Option | Default | Workload | Meaning |
| --- | --- | --- | --- |
| `--statuses <n>` | 50 | status-flood | Statuses per tick. |
| `--flood-interval <ms>` | 500 | status-flood | Time between ticks. |
| `--flood-ticks <n>` | 40 | status-flood | Ticks per flood. |
| `--flood-pool <n\|all>` | all | status-flood | Stories the flood writes to (see below). |
| `--index-requests <n>` | 20 | status-flood, browse-search | `index.json` requests. |
| `--query <text>` | per project | status-flood, browse-search | Sidebar search text. |
| `--arrows <n>` | 20 | browse-search | ArrowDown presses per list. |
| `--visits <n>` | 10 | browse-search | Stories to visit. |
| `--vitest-runs <n>` | 1 | vitest-run | 2 adds a second run on the warm Vitest child. |

## Projects

**Synthetic.** A React + Vite project, generated once per build and shape. The harness installs it
with npm. Every story file holds one component and 5 stories and imports React.

- `balanced`: roots of 20 components each (`Root007/Comp00123`).
- `wide`: one root that holds every component (`Root/Comp00123`).
- `docgen`: the SB-2057 project. Each component has typed props, 2 stories, and an autodocs page.
  It turns on `features.experimentalDocgenServer`.

The project is a git repository with one commit, so change detection starts with no changes.

**Chromatic.** The chromaui/chromatic webapp: nextjs-vite, about 490 story files, 3,840 index
entries, addon-vitest. The harness makes one git worktree per build at
`<chromatic>.worktrees/perf-harness-<build key>`, detached at a pinned commit. It then:

1. points every Storybook monorepo package at the build (dependencies and root `resolutions`);
2. adds `experimentalDocgenServer: process.env.PERF_HARNESS_DOCGEN_SERVER === '1'` to `main.ts`
   (only the `docgen` workload sets it);
3. patches `.storybook/forceReact18.ts`. Storybook 11's nextjs-vite adds aliases to Next's
   compiled React 19 after `viteFinal`. Without the patch, every story throws
   `Cannot read properties of undefined (reading 'S')`. The patch removes those aliases;
4. runs `yarn install` and `npx playwright install chromium` (for Vitest browser mode);
5. commits the changes in the worktree, so change detection starts with no changes.

The dev server runs with `--max-old-space-size=8192`.

## Workloads

Each workload is a list of phases. Before a phase starts, the harness waits until no channel frame
has moved for 2 s and throws away all counters. After the phase, it waits again, then reads every
counter. So a number in a phase is the cost of that phase only.

Phases that more than one workload uses:

- `boot`: server process start to the first `index.json` response.
- `open`: open the manager on the first story, until the preview reports the first render
  (`storyRendered`, `docsRendered`, or an error event).
- `idle`: 5 s with no action. It gives the server's CPU when nothing happens.
- `indexJson`: `GET /index.json` N times in a row.
- `changeScan`: save one story file with an added comment, wait, restore it. Each save runs HMR,
  the indexer for that file, and a change-detection scan.

**status-flood** (synthetic by default)

1. `open`, then `expandAll`: the manager emits `storiesExpandAll`, so every sidebar node shows.
2. `idle`, `indexJson`, `changeScan`.
3. `flood`: the server writes N statuses every 500 ms for 40 ticks, through the project's own
   `experimental_getStatusStore('bench/flood')`. No Vitest runs. Values cycle success, warning,
   error. Tick k writes stories k·N to (k+1)·N − 1 of the pool, so the store grows by N statuses a
   tick. With `--flood-pool all` the pool is every story in index order. A number gives that many
   stories, spread evenly over the index.
4. `floodSearch`: type the search query in the sidebar, then the same flood. The results list shows
   instead of the tree.

The flood status type is empty at the start of each flood.

**browse-search** (Chromatic by default)

1. `open`, `idle`, `indexJson`, `changeScan`.
2. `searchType`: click the search field, type the query one key at a time.
3. `searchArrows`: ArrowDown N times in the results.
4. `treeArrows`: clear the search, focus the first story in the tree, ArrowDown N times.
5. `visit`: select N stories spread over the index. Each selection goes from the preview, as a link
   in a story does.

**vitest-run** (Chromatic)

1. `open`.
2. `vitestRun`: click **Run tests** in the sidebar testing widget. The run ends when the button is
   enabled again. The first run also starts the Vitest child process.

**docgen** (synthetic `docgen` shape by default): the SB-2057 session. Phases: `open`,
`extractAll`, `burst`, `singleSaves`, `singleCommands`, `storyDocs`, `review`, `bootstrapTab2`,
`burstTwoTabs`. See `workloads/docgen.mjs`.

## Metrics

The harness does not change Storybook. It wraps the transports from outside:

- `instrument/inpage.js` runs in every browser frame before page scripts (Playwright
  `addInitScript`).
- `instrument/preload.mjs` runs in the dev server (`node --import`). Node passes `--import` on to
  the Vitest child that addon-vitest starts, so the child runs it too.

### Wire bytes

Bytes of every channel frame, per link and per event type, recorded at the transport:

| Link | Where the harness records it |
| --- | --- |
| server→manager, manager→server | Manager `WebSocket` receive and `send`. |
| server→preview, preview→server | Preview `WebSocket` receive and `send`. |
| manager→preview, preview→manager | `message` event listeners of the receiving frame. |
| server→vitest child, vitest child→server | Server `ChildProcess.prototype.send` and `'message'` events. |

- A websocket or postMessage frame counts as the length of its JSON text. For ASCII text this is
  the UTF-8 byte count.
- An IPC message counts as `v8.serialize(message).length` when the child uses
  `serialization: 'advanced'`, else as the JSON text length plus 1. The harness reads the
  serialization mode from the spawn options. addon-vitest starts the child with execa's
  `execaNode`, which uses `advanced`.
- The event type is the channel event type. For a UniversalStore frame, the store event follows it,
  for example `UNIVERSAL_STORE:storybook/status __SET_STATE`.
- `vitest child → server IPC bytes (child view)` is the same link measured in the child. Use it to
  check the server-side number.

### Browser main thread

Manager and preview are same-origin frames. They share one renderer main thread and one V8 heap.

- `main thread long tasks`: tasks of 50 ms or more (Long Tasks API), from both frames, merged.
- `main thread total blocking time ms`: the sum of (duration − 50 ms) over those tasks.
- `main thread longest task ms`: the longest of those tasks.
- `main thread long task ms, preview frame`: long-task time that the browser attributes to the
  preview frame.

### Interactions (manager)

An interaction starts at one of these points:

- **status event**: the manager's websocket handler starts on a
  `UNIVERSAL_STORE:storybook/status` frame;
- **key press**: the `keydown` event's time stamp (`key:<name>`);
- a named action, for example `expandAll`.

The harness credits every DOM mutation in the manager document to the latest interaction. After
each mutation batch, it waits for the next animation frame and then a macrotask
(`requestAnimationFrame` + `setTimeout(0)`). That point comes after style, layout, and paint of the
frame that shows the mutation. **Settled** is the latest such point. With no mutation, settled is the
first such point after the start. The harness ignores mutations more than 5 s after the start. When
the next interaction starts, the previous one closes.

- `… → settled p50/p95/max ms`: start to settled.
- `status event: handler p50 ms`: time in the websocket message handler (parse and dispatch, not
  the React work that it schedules).
- `status event: bytes p50`, `status event: DOM mutation records p50`.

When the manager cannot finish the work of one status event before the next one arrives, work
piles up. Then settled times grow over the flood. This is a real effect, not a harness error.

### Server and Vitest child

- `server CPU ms`: `process.cpuUsage()` (user + system) of the dev server over the phase.
- `server CPU ms per index.json request`: CPU measured tightly around the requests, divided by N.
- `server idle CPU ms per s`: CPU per second in the `idle` phase.
- `server git processes`: `git` processes that the server started in the phase (all spawn, exec,
  and sync variants).
- `server event-loop max delay ms`: from `monitorEventLoopDelay`.
- `vitest child CPU ms`: `process.cpuUsage()` of the Vitest child over the phase.

### Heap

After two forced garbage collections, at the end of the session:

- server and Vitest child: `process.memoryUsage().heapUsed`;
- browser: CDP `Runtime.getHeapUsage` of the tab. This is manager and preview together, because
  they share one V8 isolate.

## Paste the table into a PR

`report.md` starts with a heading, the two builds, run counts, and the machine. A short table
follows with the headline numbers, then every metric of every phase in a collapsed `<details>`
block. Paste the whole file into the PR description. Ratio is after/before; lower is better for
every metric except counts that you expect to change.

Compare numbers only when the machine, workload options, and project are the same.

## Clean up

```sh
git -C ~/dev/chromaui/chromatic worktree remove --force ~/dev/chromaui/chromatic.worktrees/perf-harness-<key>
rm -rf ~/.cache/storybook-perf-harness
```

The harness kills the dev server (its whole process group) and the browser after each run. If a
run crashes, check that nothing listens on ports 6106, 7106, and 7107.
