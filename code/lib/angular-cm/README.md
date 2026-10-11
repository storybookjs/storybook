# Angular Component Meta

In-process Angular docgen: reads component metadata straight from TypeScript sources with a warm `LanguageService`.

`AngularComponentMetaManager` keeps one warm `LanguageService` per matched tsconfig and emits a Compodoc-shaped record, which this package's own `extractArgTypes` turns into argTypes.

This package is Node-only and internal: it is bundled into `@storybook/angular-vite` rather than published.

## Relationship to `@storybook/angular-compodoc`

The conversion here is a deliberate fork of the one in `@storybook/angular-compodoc`, which is deleted in Storybook 11 along with the Compodoc pipeline.
That copy stays frozen on the legacy behaviour its committed baselines pin; this one is the successor and carries only the corrected rules, so the two are **not** kept in sync and fixes belong here.

## Known limitations

These are inherited from the Compodoc behaviour this replaces, and are not fixed yet:

- **Numeric enums produce no control.** `enum Size { Small, Medium }` and `enum Size { Small = 1, Medium }` both surface as `empty-enum` rather than a select, because auto-incremented members carry no initializer to read. String enums and union type aliases resolve correctly. The type checker could answer this via `getConstantValue`, so this is fixable here in a way it was not in Compodoc.
- **Inputs and outputs inherited from compiled libraries are skipped.** A base class from a `.d.ts` contributes its plain properties and methods but not its IO, because the decorators are erased; Angular records them in `ɵɵDirectiveDeclaration` type arguments, which this analyzer does not read.
- **`hostDirectives` bindings are absent.** Inputs and outputs a component exposes through directive composition are not class members, so they never reach the props table.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
