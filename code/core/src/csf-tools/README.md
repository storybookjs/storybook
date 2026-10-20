# Storybook CSF Tools

An experimental library to read, analyze, transform, and write CSF programmatically.

- Read - Parse a CSF file with OXC
- Analyze - Extract its metadata & stories from the ESTree AST
- Transform - Edit stories through `CsfFile.objects()` and preview or main configuration directly through `ConfigFile`
- Write - Write the edited source back to a file; code no edit touches stays as written

It can parse MDX into CSF.

`CsfFile.meta.component` is the meta's `component` as written. `CsfFile.componentImport` is the import it refers to, as `{ source, imported, local }`, so `import { Button as B } from './Button'` gives `{ source: './Button', imported: 'Button', local: 'B' }`; `imported` is `'default'` for a default import. It is `undefined` when `component` is not an identifier bound by a default or named import, such as a local component, a namespace import or a member like `UI.Button`, or `Button as any`.

## Transforming stories

`CsfFile.objects()` returns one `CsfObject` editor per mutable object it can prove safe to edit: the meta, each story export, and each CSF2 `Story.parameters` / `Story.argTypes` annotation assignment.
`{ meta, stories }` narrows what is discovered; both are included by default. Story discovery also includes separate CSF2 parameter assignments, so callers use the same paths regardless of the source format.

Each editor reads and writes static property paths with `get`, `getValue`, `inspect`, `set`, `transform`, `remove`, `rename`, `move`, and `group`.
`get` returns an AST expression; `getValue` reads plain values from literals, nested arrays and objects, and local constants without executing code. Reads never return a partially decoded object.

`get` and `getValue` return `undefined` both for a field that is missing and for one that cannot be read statically. Only the second adds a `CsfMutationDiagnostic` to `mutationDiagnostics`. For `get` that is a path whose parent is not an object literal, or that a spread, a computed key, or a duplicate field leaves unproven; `getValue` also reports a value it cannot evaluate, such as a call or a function. A field written as `undefined` is `undefined` without a diagnostic too, but `get` returns its expression. `inspect` tells the cases apart without recording a diagnostic. It reads the expression like `get`, without evaluating it:

```ts
const size = story.inspect(['args', 'size']);
if (size.kind === 'value') {
  // `size.node` is the expression, `undefined` included
} else if (size.kind === 'unreadable') {
  // `args.size` may be set where it cannot be read statically: see `size.diagnostic.code`
} else {
  // `args.size` is missing
}
```

Read diagnostics count like mutation ones, so `writeConfig` refuses a config after a read that added one. Use `get` and `getValue` for the reads an edit depends on, so a file whose shape was not proven is not written, and `inspect` for reads that only inform, such as an addon showing a field.

`set` accepts an expression from `get` or `parseExpression`, or plain strings, numbers, booleans, `null`, `undefined`, and nested arrays or objects of those values and expressions. An object whose `type` names an AST node is rejected with a diagnostic unless it came from `get` or `parseExpression`. Plain values are printed into the source, so later changes to the input do not affect the file.
An expression from `get` is indented as if its line had no indent, and `set` and `transform` indent a value's lines like the line of the field it is written to, so a value copied between fields keeps its layout.
Successful removals and moves recursively remove empty source parents, stopping at the editor's root object or an empty parent that shadows an earlier spread or computed key. Removing a field that could reveal an earlier spread value produces a diagnostic. Moves clean up after inserting the destination, so shared ancestors remain intact. Unrelated empty objects are preserved.
Nested object paths can follow local constants used only by that object; shared or reassigned references remain untouched.
Nodes reused by `transform` keep their original source, so relocating a value prints it as written instead of pretty-printing it.
`group(path, names)` nests named siblings under a destination object, retaining their source order. A new group replaces a contiguous run of source fields at their original position. Grouping into an existing object requires values whose relocation cannot change expression evaluation order. Conflicts, ambiguous keys, and unsafe relocations produce diagnostics before the operation changes the source; absent source fields are ignored.
`node` is the editor's object literal in the current parse: the meta or story object, a call argument, a config object, or for a CSF2 annotation editor the assigned object that its annotation path (such as `['parameters']`) names. It is the file's own node, found again after every mutation: read it after editing instead of keeping it, and do not change it, since edits go through the source. It is `undefined` for a config made of named exports and once the object is gone.
Annotation editors take the same paths as their story counterparts, so `['parameters', 'a11y']` addresses `Story.parameters.a11y` and an inline `parameters.a11y` alike.

Discovery and mutation are conservative: an object or a path whose shape cannot be proven is left untouched, and the reason is reported on `CsfFile.mutationDiagnostics` as a `CsfMutationDiagnostic`.
Unproven shapes include story or meta bindings that are reassigned or aliased, a CSF factory configuration that is not an object literal owned by that single factory call, dynamically computed annotation names, and target paths shadowed by a spread, a duplicate field, or a computed key.
`set` can still add a field missing from an object with a spread or a computed key: the field is appended after them, so it overrides any value they provide. It cannot create a missing parent there, nor change a field that a later spread or computed key could override.

`CsfFile.changed` is true once any mutation has been applied, which is the signal for whether the file needs to be written back.

Each mutation is applied on its own. To apply several as one, run them in `transaction(fn)` on `CsfFile` or `ConfigFile`: when `fn` throws, returns `false`, or any mutation in it returns `{ ok: false }`, every edit made in it is rolled back, and `changed` with it. Mutations inside return their results as usual, and the diagnostics of refused ones stay on `mutationDiagnostics`. `transaction` returns whether the edits were kept. `fn` runs synchronously; one that returns a promise throws. A transaction inside another rolls back on its own, and with the outer one.

```ts
for (const story of csf.objects()) {
  const handlers = story.get(['parameters', 'msw', 'handlers']);
  if (handlers) {
    csf.transaction(() => {
      story.remove(['parameters', 'msw']);
      story.set(['beforeEach'], parseExpression(`() => worker.use(...${placeableTextOf(handlers)})`));
    });
  }
}
```

## Transforming preview and main configuration

`ConfigFile` implements `CsfObject` directly, exposing the same methods and mutation results as the editors returned by `CsfFile.objects()`. Config files use `{ kind: 'config' }` as their target. Default-exported objects, identifier-backed objects, `definePreview` configurations, and CommonJS `module.exports` use their config object as the root.

Named variable and function exports are presented as fields of one logical root. This lets the same paths address both `export default { parameters: ... }` and `export const parameters = ...`. Moves between exported fields, creation and removal of exports, and empty-parent cleanup are synchronized with the source declarations.

```ts
const config = loadConfig(source).parse();
config.rename(['parameters', 'a11y', 'element'], 'context');
config.set(['parameters', 'a11y', 'test'], 'todo');
config.set(['tags'], ['autodocs']);
if (config.changed && config.mutationDiagnostics.length === 0) {
  const output = printConfig(config).code;
}
```

`ConfigFile.changed` and `ConfigFile.mutationDiagnostics` track these editor operations. Existing `getFieldNode` reads reflect editor changes. `writeConfig` rejects files with mutation diagnostics to avoid writing partial edits.

`appendValueToArray`, `appendNodeToArray`, and `removeEntryFromArray` return a `CsfMutationResult` like the editor operations. A field that is not an array literal leaves the file as it is and adds an `unsupported-value` diagnostic; a missing field or entry is a no-op for `removeEntryFromArray`.

`setImport`, `setRequireImport`, and `removeImport` look at every import or top-level `require` of the module, and take a named binding as `'name'` or `'name as alias'`. `setImport` and `setRequireImport` skip a binding the module already provides under that local name. A binding that only an `import type` provides becomes a value import; other type-only imports are left alone. `removeImport` removes every import of a plain name, whatever its local name, but only the matching import of an alias. Added statements follow the file's quotes and semicolons. Import helper edits are not tracked by `changed`.

Discovery rejects shared or reassigned bindings, unresolved re-exports, and conditional or repeated CommonJS assignments. Inline object methods and exported function declarations can be transformed as function expressions while retaining their declaration form. Path edits use the same spread, duplicate-key, occupied-destination, and dynamic-value checks as story edits. Unsupported input produces diagnostics without rewriting that input.

## Transforming method call arguments

`ConfigFile.callArguments()` returns `CsfObject` editors for the first object argument of matching imported method calls. It follows named ES module imports and destructured CommonJS imports, including aliases, while ignoring shadowed bindings. Non-object arguments and reassigned imports produce diagnostics. Calls without arguments are ignored.

```ts
const manager = loadConfig(source).parse();
for (const object of manager.callArguments({
  importedName: 'addons',
  methodName: 'setConfig',
  moduleNames: ['storybook/manager-api'],
})) {
  object.group(['layout'], ['showNav', 'showPanel']);
  object.group(['ui'], ['enableShortcuts']);
}
if (manager.changed && manager.mutationDiagnostics.length === 0) {
  const output = printConfig(manager).code;
}
```

These editors share the file's change tracking and diagnostics and expose the same read and mutation methods as configs and stories.
