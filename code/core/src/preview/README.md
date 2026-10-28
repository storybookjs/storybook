# Preview

Preview-side glue that is not part of the preview API.

- `hooks.ts`: the `preview:*` hooks (`PreviewHooks`) for annotations, entries, head, body, log level, and HMR; see [HOOKS.md](../instance/HOOKS.md).
- `globals.ts` and `globals/`: the map from module names to the `__STORYBOOK_MODULE_*__` globals the preview shares with addons, exported as `@storybook/core/internal/preview/globals`.
- `preview-navigator.ts`: the in-iframe story navigator shown with `?navigator=true`.
- `utils.ts`: `prepareForTelemetry`, which attaches browser info to preview errors.

The preview API itself (`PreviewWeb`, the story store, and addons) lives in `preview-api`; see [README-preview-web.md](../preview-api/README-preview-web.md).
