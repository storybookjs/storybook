# core.dev-server: preview build fails with "Can't resolve 'path'"

- Where: `.storybook/main.js` `webpackFinal`, the `config.resolve.fallback` object (lines 22-26 before the fix). It only set `fs` and `vm`.
- Why it fails: `@storybook/nextjs` 11.0.0-beta.3 no longer polyfills `path`. The migration guide lists `path` under "Next.js: most Node.js built-in polyfills removed from `@storybook/nextjs`". `next-i18next` and `picomatch` import it, so webpack 5 fails with 7 `Module not found: Error: Can't resolve 'path'` errors (see `upgraded-dev.log`).
- Fix tried: add `path: false` to `resolve.fallback`. The guide offers this as the "empty module" option. It was chosen over `path-browserify` because that needs a new npm package, and the project's CLAUDE.md says not to install packages without asking.
- Upgrade output: neither `upgrade-force.log` nor the doctor run printed anything about this removal.
