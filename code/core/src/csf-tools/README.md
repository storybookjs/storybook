# Storybook CSF Tools

An experimental library to read, analyze, transform, and write CSF programmatically.

- Read - Parse a CSF file with Babel
- Analyze - Extract its metadata & stories based on the Babel AST
- Transform - Edit stories through `CsfFile.objects()` and preview or main configuration directly through `ConfigFile`
- Write - Write the AST back to a file

It can parse MDX into CSF.

## Transforming stories

`CsfFile.objects()` returns one `CsfObject` editor per mutable object it can prove safe to edit: the meta, each story export, and each CSF2 `Story.parameters` / `Story.story` annotation assignment.
`{ meta, stories }` narrows what is discovered; both are included by default. Story discovery also includes separate CSF2 parameter assignments, so callers use the same paths regardless of the source format.

Each editor reads and writes static property paths with `get`, `getValue`, `set`, `transform`, `remove`, `rename`, `move`, and `group`.
`get` returns an AST expression; `getValue` reads plain values from literals, nested arrays and objects, and local constants without executing code. Missing fields return `undefined`. Values that cannot be resolved statically return `undefined` and add a mutation diagnostic; reads never return a partially decoded object.
`set` accepts Babel expressions or plain strings, numbers, booleans, `null`, `undefined`, and nested arrays or objects of those values. Values are copied into the AST; subsequent changes to the input do not affect the file. Top-level expression-shaped objects are interpreted as AST nodes.
Successful removals and moves recursively remove empty source parents, stopping at the editor's root object or an empty parent that shadows an earlier spread or computed key. Removing a field that could reveal an earlier spread value produces a diagnostic. Moves clean up after inserting the destination, so shared ancestors remain intact. Unrelated empty objects are preserved.
Nested object paths can follow local constants used only by that object; shared or reassigned references remain untouched.
Nodes reused by `transform` keep their original source, so relocating a value prints it as written instead of pretty-printing it.
`group(path, names)` nests named siblings under a destination object, retaining their source order. A new group replaces a contiguous run of source fields at their original position. Grouping into an existing object requires values whose relocation cannot change expression evaluation order. Conflicts, ambiguous keys, and unsafe relocations produce diagnostics before the operation changes the source; absent source fields are ignored.
Annotation editors take the same paths as their story counterparts, so `['parameters', 'a11y']` addresses `Story.parameters.a11y` and an inline `parameters.a11y` alike.

Discovery and mutation are conservative: an object or a path whose shape cannot be proven is left untouched, and the reason is reported on `CsfFile.mutationDiagnostics` as a `CsfMutationDiagnostic`.
Unproven shapes include story or meta bindings that are reassigned or aliased, a CSF factory configuration that is not an object literal owned by that single factory call, dynamically computed annotation names, and target paths shadowed by a spread, a duplicate field, or a computed key.

`CsfFile.changed` is true once any mutation has been applied, which is the signal for whether the file needs to be written back.

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

`ConfigFile.changed` and `ConfigFile.mutationDiagnostics` track these editor operations. Existing `getFieldNode` reads reflect editor changes. Array and import helpers remain available; their edits are not tracked by `changed`. `writeConfig` rejects files with mutation diagnostics to avoid writing partial edits.

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
