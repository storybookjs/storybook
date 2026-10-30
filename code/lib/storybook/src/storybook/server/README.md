# Storybook server

The Node side of `storybook dev` and `storybook build`, exported as `storybook/internal/server`.
It hosts a Storybook instance: the dev server, the preview-only host, story screenshots, the toolset RPC host and the instance registry.
The instance itself, its addons and its hooks live in core: see the [instance README](../../../../../core/src/instance/README.md) and [HOOKS.md](../../../../../core/src/instance/HOOKS.md).

## Layout

- `build-dev.ts`: `storybook dev`; resolves the port and addresses, creates the instance and calls `storybook.dev()`.
- `start-dev-server.ts`: the `dev` host `../instance.ts` injects; wires the dev server for one instance.
- `dev-server.ts`: mounts the manager and the preview builder on the dev server app.
- `build-static.ts`: `storybook build`; checks and cleans the output dir, creates the instance and calls `storybook.build()`.
- `run-static-build.ts`: the `build` host `../instance.ts` injects; writes the manager, preview, index and static files of one instance.
- `preview-host.ts`: serves the preview of an instance on its own, with no manager.
- `story-screenshot.ts`: screenshots stories in a headless Chromium.
- `in-process-transport.ts`: answers HTTP requests inside the process, with no socket.
- `common.ts`: the product common addon.
- `hooks.ts`: declares the `server:*` hooks.
- `utils/toolset-rpc-host.ts`: serves the toolset RPC on the dev server channel.
- `utils/runtime-instance-registry.ts`: writes and cleans the instance records.
- `presets/`: the defaults `common.ts` registers.
- `server-channel/`: server-side channel handlers.

## Common addon

`common.ts` exports `commonAddon`, which `createStorybook` in `../instance.ts` installs as the `common` addon.
It runs core's common addon first, then registers the product defaults from `presets/common-defaults.ts`.
It provides `core:story-render:extend` with a `createStoryScreenshotAccess` for the instance, and closes it on `core:instance:close`.
Core alone has no story renderer, so `stories.screenshot` needs this addon.

## Dev server wiring

`storybook.dev()` runs `startDevServer` in `start-dev-server.ts`, which wires a ready `mode: 'dev'` instance in this order:

- Channel transport: `attachServerTransport` attaches the instance channel to the HTTP server, guarded by the channel token.
- Toolset RPC host: `serveToolsetRpc` listens on that channel.
- `server:channel:ready` fires.
- `storybookDevServer` starts the manager and the preview builder.
- Instance record: `writeStorybookRuntimeInstanceRecord` writes the record with `toolsetRpc`.

The record comes last, so a client that finds it can already connect and call.
Its `close()` disposes the RPC host and the transport first, then closes the HTTP server and the record together.
`storybook.close()` starts it before the instance teardown and settles both together.

## Toolset RPC host

`serveToolsetRpc` (`utils/toolset-rpc-host.ts`) lets an attached tools client describe and call the instance's toolsets on the dev server.
The client loads no configuration.

- Toolsets are read per request, so late registrations show.
- `ctx.origin` is the dev server's base URL, deployment subpath included, unless the invoke passes `origin`.
- `ctx.transport` is the client's `clientInfo.transport`.
- `ctx.signal` aborts on `toolsets:call-cancel` or teardown; handlers may ignore it.
- Calls send no telemetry; the client hands over its finished `tools-command` record with `toolsets:telemetry`, and the host sends it under its own configuration.

The messages are owned by the [open-service README](../../../../../core/src/shared/open-service/README.md#toolset-rpc).
The client flow, gates and failures are owned by [the tools architecture](../cli/tools/architecture.md).

## Instance registry

`utils/runtime-instance-registry.ts` writes one JSON record per running dev server to `~/.storybook/instances/<instanceId>.json`.

- The directory is `0700` and each record `0600`; on Windows an owner-only ACL is set with `icacls`.
- Records are written to a temp file and renamed into place.
- The record carries the URL, port, pid, cwd, config dir, channel token, MCP status, `storybookPath`, `corePath` and `toolsetRpc`.
- `toolsetRpc` is `TOOLSET_RPC_PROTOCOL_VERSION`, currently `1`.
- Cleanup removes the record on exit, and prunes stale temp files, malformed records and records of dead pids.

The SDK reads these records; how it matches and gates them is in [the tools architecture](../cli/tools/architecture.md).

## Preview host

`startPreviewHost` (`preview-host.ts`) serves only the preview of an instance: `iframe.html`, `index.json`, static dirs and the builder.
It has no manager, no channel transport and no instance record.

- It skips `server:app:extend`, because that hook mounts dev-server endpoints and starts dev-only service subscriptions.
- It returns `{ origin, dispatch?, close }`.
- `close()` bails the builder and destroys open sockets, HMR and channel sockets included.

### Transports

The preview host has two transports.
The `'in-process'` preview transport is unrelated to the open-service host kind `tools.host === 'in-process'`.

- `'port'`: the default; listens on a loopback port, `127.0.0.1:0`, and returns `http://127.0.0.1:<port>/`.
- `'in-process'`: no socket; returns the synthetic origin `http://storybook.preview/` and a `dispatch` function.

The `'in-process'` transport uses `createInProcessTransport` (`in-process-transport.ts`).
It runs the app's request listener against an in-memory `IncomingMessage` and `ServerResponse`, and buffers the response.

- The browser intercepts requests to the synthetic hostname with Playwright's `route` and answers them with `route.fulfill`.
- WebSockets to that hostname get a silent mock.
- It is opt-in only: `createStoryScreenshotAccess(storybook, { transport: 'in-process' })`.
- `common.ts` calls `createStoryScreenshotAccess` without options, so the product always uses `'port'`.
- It is slower per warm screenshot, roughly 25%, because every response body crosses the DevTools protocol.
- It is tested with builder-vite only.

### Builders without a host server

`BuilderDevHost.server` is optional (`core/src/instance/addons.ts`).
It is absent with the `'in-process'` transport.
builder-vite then sets `hmr: false, ws: false` (`builders/builder-vite/src/vite-server.ts`).

## Story screenshots

`createStoryScreenshotAccess` (`story-screenshot.ts`) implements the story render access behind `stories.screenshot`.

- It launches Chromium lazily, from `playwright-core` or `playwright`, resolved from the project's config dir first.
- Neither installed, or a failed launch, throws `StoryScreenshotBrowserUnavailableError`.
- A request with an `origin` renders against that origin.
- A request without one starts a preview host once and reuses it.
- It records preview channel events with an init script to decide `rendered`, `errored`, `play-failed` or `timeout`.
- `close()` closes the browser and the preview host.

When the tools run attached, the dev server passes its own origin, so the preview host starts only for local runs.
