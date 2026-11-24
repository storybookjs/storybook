# core.story-render: cause (SWC plugin failure after upgrade)

- Before the upgrade `yarn.lock` held two `@swc/core` versions: `1.15.18` (for `^1.15.11`) and `1.16.2` (for `~1.16.0`).
- The upgrade's monorepo dedupe step merged them into `@swc/core@1.16.2` (see `upgrade.log`, "can be deduped from @swc/core ... to ...").
- `@lingui/swc-plugin@5.11.0` (`packages/twenty-front/package.json`, `^5.11.0`) is built for an older swc_core. With host `@swc/core@1.16.2` the Vite React SWC transform of `.storybook/preview.tsx` fails.
- Error (from `post-story.png`): `failed to invoke plugin ... lingui_macro_plugin.wasm: failed to run Wasm plugin transform ... swc_plugin_runner: 34.0.0 : Failed to deserialize program received from host`.
- Newest `@lingui/swc-plugin` 5.x on npm is 5.11.0, so no plugin bump fixes it.
- Fix tried: pin `@swc/core` to `1.15.18` with root `resolutions`.
