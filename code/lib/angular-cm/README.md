# Angular Component Meta

In-process Angular docgen: reads component metadata straight from TypeScript sources with a warm `LanguageService`.

`AngularComponentMetaManager` keeps one project per matched tsconfig and emits the record shape the argTypes extractor consumes, so the props table is built from the same conversion no matter which provider produced the metadata.

This package is Node-only and internal: it is bundled into `@storybook/angular-vite` rather than published.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
