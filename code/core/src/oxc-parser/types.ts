/**
 * A single import edge extracted from a source file. `specifier` is the literal token the
 * source used (e.g. `./foo`, `lodash`, `@scope/pkg`). `kind` distinguishes the three edge
 * flavours the oxc-parser surfaces: static `import`/`export`, dynamic `import()`, and
 * CommonJS `require()`.
 */
export interface ImportEdge {
  specifier: string;
  kind: 'static' | 'dynamic' | 'require';
}
