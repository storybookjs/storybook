# Angular Component Meta

In-process Angular docgen: reads component metadata straight from TypeScript sources with a warm `LanguageService`, instead of shelling out to [Compodoc](https://compodoc.app/).

`AngularComponentMetaManager` keeps one project per matched tsconfig and emits the same Compodoc-JSON subset that `@storybook/angular-compodoc` converts into argTypes, so both producers feed a single conversion.

This package is Node-only and internal: it is bundled into `@storybook/angular-vite` rather than published.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
