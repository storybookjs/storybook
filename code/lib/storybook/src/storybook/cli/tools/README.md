# Tools CLI

`storybook tools` is a shell over the Node SDK in `@storybook/open-service`.
The SDK owns both modes: **attached** (use a running Storybook) and **local** (load the project configuration on its own).

Attached to a dev server that serves the toolset RPC, toolset handlers run in the dev server and the CLI loads nothing.
Attached to an older server, the SDK joins it as a delegated runtime: handlers run in the SDK process and service commands execute on the instance (see the [open-service README](../../../../../../core/src/shared/open-service/README.md#delegated-mode)).
Locally, everything runs in the SDK process or a child host.

## SDK

The SDK is [`@storybook/open-service`](../../../../../open-service/README.md): usage, the factory vs `call` table, and the instance factory rule live there.
The CLI passes the product `createStorybook`, so it loads exactly what `storybook dev` loads.

## CLI flags

Default mode is `auto`: attach when a matching instance is running, otherwise load locally.
`fallbackNotice` and every other notice go to stderr, never to stdout or the `-o` file.
`--json` keeps stdout to the tool result only.

| Flag          | SDK `mode` | On gate failure                                              |
| ------------- | ---------- | ------------------------------------------------------------ |
| (none)        | `auto`     | Fall back to local. Notice only on unexpected attach failure |
| `--attach`    | `attached` | Hard error (no fallback)                                     |
| `--no-attach` | `local`    | Never attaches                                               |

`--cwd`, `--config-dir`, and `--port` belong **before** the toolset name (after it, they are tool arguments).
`--attach` / `--no-attach` cannot be combined.
`requiresDevServer` is a **local-mode intercept** only: when attached, those methods run, on the dev server over the toolset RPC, or caller-side on an older server (`stories.preview` then reads `origin` from the instance record).

Tool arguments are `--key value` flags spelled exactly like the input schema keys (camelCase, e.g. `--storybookId`); there are no kebab-case aliases.
Toolset inputs are `v.strictObject`, so a flag or `--input` key the tool does not declare is an invalid-input error, and the CLI names the flag and lists the valid ones.

A repeated flag overwrites its earlier value, except `--story <id>`: it is repeatable and appends `{ "storyId": "<id>" }` to `stories`, after any entries from `--stories` or `--input`.
It is the short form for `stories preview` and `stories screenshot`.

`docs` honours the project's `refs`: with composed Storybooks, `docs list` prints one section per source and `docs show` / `docs show-story` take `--storybookId`, which defaults to `local`.
When that source does not have the id, `docs show` shows it from the one other source that has it, and otherwise suggests the closest ids.
Remote manifests are fetched without credentials and with a 3 second timeout in every mode; a ref that cannot be read gets its own error section.

## Story screenshots

- `stories screenshot` does not need a dev server: locally it starts its own preview host.
- It needs `playwright` or `playwright-core` installed in the project.
- When attached, it runs on the dev server, so `--outDir` and the returned image paths resolve on that host, against the dev server's cwd.

```bash
npx storybook tools docs list
npx storybook tools --attach docs list
npx storybook tools --no-attach docs list
npx storybook tools --cwd /apps/web --config-dir /apps/web/.storybook docs list
npx storybook tools --port 6007 stories preview --stories '[{"storyId":"example-button--primary"}]'
npx storybook tools stories screenshot --story example-button--primary --story example-button--secondary
```

## Modes

How attach, child hosts and local loading work is in [architecture.md](./architecture.md).
It also owns the failure matrix and telemetry.

## Tests

- Unit: `yarn test cli/tools` for the CLI shell, `yarn test code/lib/open-service` for the SDK (memfs for the instance registry; no direct `globalThis` assignment)
- Attach e2e: `cd code && yarn playwright test -c e2e-internal/playwright.config.ts e2e-internal/tools-attach.spec.ts`

Run e2e from the same checkout that serves the internal UI.
Discovery matches instances by cwd and config dir, so a CLI from another checkout does not find that instance.
