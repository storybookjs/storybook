# Component Meta TypeScript

The TypeScript layer of Storybook's component-meta docgen, shared by `@storybook/react` and `@storybook/angular-cm`.

The extractors are written against `DocgenTypeScript`, a structural subset of the `typescript` module. TypeScript 5.9 and 6 fulfil it with their compiler API; TypeScript 7.1 and newer with a facade over the native API (`typescript/sync`, `typescript/ast`), whose checker runs in a child process.

This package is Node-only and internal: it is bundled into the packages that use it rather than published.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
