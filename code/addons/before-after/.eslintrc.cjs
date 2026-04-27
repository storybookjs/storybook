// Addon-scoped ESLint rules for `@storybook/addon-before-after`.
//
// We bar `als.enterWith(...)` (and any `.enterWith(...)` MemberExpression that
// looks like an AsyncLocalStorage call). The plugin's crash-containment design
// relies on `als.run(store, fn)` to bound the lifetime of the per-request
// scope; `enterWith` flips the store globally for the rest of the async chain
// and silently leaks the addon's identity into unrelated code, breaking the
// `unhandledRejection` gating verified by `crash-containment.test.ts`.
//
// See `.omc/plans/before-after-vite-env-api.md` §6 (Pre-mortem #3) and
// `ADR-0001-vite-env-api.md` consequence #1.
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "MemberExpression[object.name='als'][property.name='enterWith'], CallExpression[callee.property.name='enterWith']",
        message:
          'Use `als.run(store, fn)` instead of `enterWith` — the latter leaks the AsyncLocalStorage scope into unrelated async chains and breaks crash containment.',
      },
    ],
  },
};
