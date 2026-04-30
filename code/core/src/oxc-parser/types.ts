/**
 * A single import edge extracted from a source file. `specifier` is the literal token the
 * source used (e.g. `./foo`, `lodash`, `@scope/pkg`). `kind` distinguishes the three edge
 * flavours the oxc-parser surfaces: static `import`/`export`, dynamic `import()`, and
 * CommonJS `require()`.
 */
export interface ImportEdge {
  specifier: string;
  kind: 'static' | 'dynamic' | 'require';
  /**
   * For static named imports (`import { Foo, Bar } from 'mod'`) the list of names as they
   * appear in the source module (i.e. before any `as` rename). `'default'` is included for
   * default imports (`import X from 'mod'`). `null` for side-effect imports, namespace
   * imports (`import * as ns`), dynamic imports, and `require()` calls.
   *
   * Used by the change-detection barrel-follower to short-circuit through re-export barrels
   * and connect a story directly to the source files of the specific symbols it needs,
   * preventing unrelated stories from being marked as related when a single component in a
   * large barrel changes.
   */
  importedNames: string[] | null;
}

/**
 * A single re-export entry extracted from a module.
 * Maps the name visible to consumers to its origin inside the barrel.
 */
export interface ReExportEntry {
  /** The specifier of the module that provides the binding. */
  specifier: string;
  /** The name of the binding in the source module (`'default'` for default imports). */
  importedName: string;
}
