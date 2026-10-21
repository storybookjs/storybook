# Storybook CSF Tools

An experimental library to read, analyze, transform, and write CSF programmatically.

- Read - Parse a CSF file with OXC
- Analyze - Extract its metadata & stories from the ESTree AST
- Transform - Edit stories through `CsfFile.objects()` and preview or main configuration directly through `ConfigFile`
- Write - Write the edited source back to a file; code no edit touches stays as written

It can parse MDX into CSF.

`CsfFile.meta.component` is the meta's `component` as written, and `CsfFile.componentImport` the import it refers to, as `{ source, imported, local }`: `import { Button as B } from './Button'` gives `{ source: './Button', imported: 'Button', local: 'B' }`, and a default import has `imported: 'default'`. It is `undefined` when `component` is not an identifier bound by a default or named import, such as a local component, a member like `UI.Button`, or `Button as any`.

## Transforming stories

`CsfFile.objects()` returns one `CsfObject` editor per mutable object it can prove safe to edit: the meta and each story export.
`{ meta, stories }` narrows what is discovered; both are included by default.
`CsfFile.storyObject(exportName)` finds one story: `{ ok: true, object }` with its editor, or `{ ok: false, diagnostic }` with the discovery diagnostic that says why it has none, which is added to `mutationDiagnostics` like those of `objects()`. It is `undefined` when the file has no story of that name. Each of `CsfFile.stories` has its `exportName`, `B` for `export { A as B }`. `storyObject(name)` answers as `objects()` does for that name, so a story that shares its object with another, such as `Copy` in `export { Basic as Copy }` or `export const Copy = Basic`, is refused as `aliased-story`, naming `Basic`: an edit would change `Basic` too, and `storyObject('Basic')` edits both.

```ts
const found = csf.storyObject('Primary');
if (!found?.ok) {
  throw new Error(found?.diagnostic.message ?? 'No story Primary');
}
found.object.set(['args', 'label'], 'Hi');
```

Each editor reads and writes static paths with `get`, `getValue`, `inspect`, `set`, `transform`, `remove`, `rename`, `move`, `group`, `append`, and `prepend`.
`get` returns an AST expression; `getValue` reads plain values from literals, nested arrays and objects, and local constants without executing code. Reads never return a partially decoded object.

`get` and `getValue` return `undefined` both for a field that is missing and for one that cannot be read statically: a path that does not fit a value, such as a key into an array or a call, or one that a spread, a computed key, or a duplicate field leaves unproven, and for `getValue` a value it cannot evaluate, such as a call or a function. A field written as `undefined` is `undefined` too, but `get` returns its expression. Reads add no diagnostics, so they never stop a later write: a mutation proves the shape it edits again and reports its own. `inspect` tells the cases apart and gives the reason. It reads the expression like `get`, without evaluating it:

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

Use `inspect` when a missing field and an unreadable one call for different edits, such as an automigration that reports a file it cannot read instead of skipping it.

The expressions `get`, `inspect` and `transform` give are frozen snapshots: `set` prints an expression from its source, so a change to its fields would be lost, and making one throws. To write another value, pass a plain value or `parseExpression(text)`.
`set` accepts an expression from `get`, `parseExpression` or `parseModule`, or plain strings, numbers, booleans, `null`, `undefined`, and nested arrays or objects of those values and expressions. A node is written as code only when it carries the parse tag: a node of the file, or one that `get`, `inspect`, `transform`, `parseExpression` or `parseModule` gave. A node of another parse, such as Babel, or a copy of a node, is rejected with a diagnostic, and any other object is data, even one shaped like a node, such as `{ type: 'Identifier', name: 'x' }`. A node is told from data by the position a parser gives it, numeric `start` and `end`, `loc` or `range`, which an object built by hand does not have, or by a type only Babel has, other than `File`, so `t.stringLiteral('x')` from `@babel/types` is refused while `t.identifier('x')` is data. Plain values are printed into the source, so later changes to the input do not affect the file.
An expression from `get` is indented as if its line had no indent, and `set` and `transform` indent a value's lines like the line of the field it is written to, so a value copied between fields keeps its layout. A field that spans lines, added to an object written on one line, puts every field of that object on a line of its own; a one-line field leaves the object on its line. Objects around it, and an object a field is grouped into, keep their layout.
Successful removals and moves recursively remove empty source parents, stopping at the editor's root object or an empty parent that shadows an earlier spread or computed key. Removing a field that could reveal an earlier spread value produces a diagnostic. Moves clean up after inserting the destination, so shared ancestors remain intact. Unrelated empty objects are preserved.
Reads follow any local constant. Edits follow only a constant that the edited object alone refers to; shared or reassigned references remain untouched.
Nodes reused by `transform` keep their original source, so relocating a value prints it as written instead of pretty-printing it.
`group(path, names)` nests named siblings under a destination object, retaining their source order. A new group replaces a contiguous run of source fields at their original position. Grouping into an existing object requires values whose relocation cannot change expression evaluation order. Conflicts, ambiguous keys, and unsafe relocations produce diagnostics before the operation changes the source; absent source fields are ignored.
`node` is the editor's object literal in the current parse: the meta or story object, a call argument, or a config object. It is the file's own node, found again after every mutation: read it after editing instead of keeping it, and do not change it, since edits go through the source. It is `undefined` for a config made of named exports, for a story without an object literal, for a CSF factory call without an argument until a write adds it, and once the object is gone.
A story's top-level `Story.name = value` assignments (CSF2 annotations such as `args`, `argTypes`, `parameters`, `decorators`, `loaders`, `beforeEach`, `play`, `render` and `tags`) are fields of the story, after the fields of its object literal if it has one. The same paths address both forms, so `['parameters', 'a11y']` is `Story.parameters.a11y` and an inline `parameters.a11y` alike. A story without an object literal, a function or a bound template, adds a missing field as a new `Story.name = value;` statement after its last annotation, or after its declaration; removing a field, or emptying it through cleanup, removes its statement. A field written both inline and as an assignment is a duplicate field.

A CSF factory meta or story written without an argument, such as `meta.story()` or `Base.extend()`, is an empty object: its fields read as missing, and its first write adds the argument like any new object, `meta.story({ args: { a: 1 } })`.

Discovery and mutation are conservative: an object or a path whose shape cannot be proven is left untouched, and the reason is reported on `CsfFile.mutationDiagnostics` as a `CsfMutationDiagnostic`.
Unproven shapes include story or meta bindings that are reassigned or shared, a CSF factory configuration that is not an object literal owned by that single factory call, and target paths shadowed by a spread, a duplicate field, or a computed key.
A story whose initializer is not an object literal, a function or a bound template, such as `export const A = base` or `makeStory()`, is reported as `unsupported-initializer`. A story that is an alias of another story of the file, such as `export const Secondary = Primary`, also through `as`, `satisfies` or other stories that alias it, holds that story's object: when that story is editable, `objects()` returns its object once, as that story, so editing it edits the alias too. Discovery reports the alias as `aliased-story`, with a message that names the story it aliases; an edit that applies alike to every story can ignore that diagnostic, as the aliased story reports its own when it is not editable. A story exported under more than one name, such as `export { Primary as A, Primary as B }`, is one object in the same way: `objects()` returns it once, under its first export, and reports each other export as `aliased-story`, as `storyObject()` does for those names; all names stay stories. A story whose alias is written to, such as `Secondary.args = {}` after `export const Secondary = Primary`, is left untouched and reported as `ambiguous-binding`, as that write changes its object. A story is also left untouched when it is written to other than by a top-level `Story.name = value`, such as `Story.args.label = 'x'`, `Story.parameters ||= {}` or `Story[name] = {}`. A story whose assignments are edited is left untouched when other code could see them: an alias, a spread, or a call or array that receives the story; calling or rendering the story is fine. Such a story without an object literal holds a function or a bound template; any other value could be shared with other stories.
`set` can still add a field to an object with a spread or a computed key. The field is appended after them, so it overrides what they provide, and a missing parent it creates there carries the spreads' member forward. In the table, the object is a story `export const A = <object>` after the code in the first column. For `append`, it is a config `export default <object>`. Each row is a test in `CsfObject.test.ts`, and those tests fail when this table differs from them.

| Declared before | Object | Edit | Result |
| --- | --- | --- | --- |
|  | `{ ...make(), [key]: 0 }` | `set(['args'], { a: 1 })` | `{ ...make(), [key]: 0, args: { a: 1 } }` |
| `import { base } from './base';` | `{ args: { ...base } }` | `set(['args', 'a'], 1)` | `{ args: { ...base, a: 1 } }` |
| `import { Base } from './base';` | `{ ...Base }` | `set(['args', 'a'], 1)` | `{ ...Base, args: { ...Base.args, a: 1 } }` |
| `import * as stories from './base';` | `{ ...stories.Base }` | `set(['args', 'a'], 1)` | `{ ...stories.Base, args: { ...stories.Base.args, a: 1 } }` |
| `import { Base } from './base';` | `{ ...(Base as Story) }` | `set(['args', 'a'], 1)` | `{ ...(Base as Story), args: { ...(Base as Story).args, a: 1 } }` |
| `import { Base } from './base';` | `{ ...Base }` | `set(['parameters', 'docs', 'a'], 1)` | `{ ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters?.docs, a: 1 } } }` |
| `import { base } from './base';` | `{ args: { ...base } }` | `set(['args', 'b', 'a'], 1)` | `{ args: { ...base, b: { ...base.b, a: 1 } } }` |
| `import { One, Two } from './base';` | `{ ...One, ...Two }` | `set(['args', 'a'], 1)` | refused, `spread-field` |
|  | `{ ...make() }` | `set(['args', 'a'], 1)` | refused, `spread-field` |
|  | `{ [key]: 0 }` | `set(['args', 'a'], 1)` | refused, `dynamic-key` |
| `const Base = { args: { b: 2 } };` | `{ ...Base }` | `set(['args', 'a'], 1)` | `{ ...Base, args: { ...Base.args, a: 1 } }` |
| `const Base = { title: 'B' };` | `{ ...Base }` | `set(['args', 'a'], 1)` | `{ ...Base, args: { a: 1 } }` |
| `const Base = { parameters: {} };` | `{ ...Base }` | `set(['parameters', 'docs', 'a'], 1)` | `{ ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters.docs, a: 1 } } }` |
| `import { One } from './base'; const Two = { args: {} };` | `{ ...One, ...Two }` | `set(['args', 'a'], 1)` | `{ ...One, ...Two, args: { ...Two.args, a: 1 } }` |
| `import { One } from './base'; const Two = { title: 'B' };` | `{ ...One, ...Two }` | `set(['args', 'a'], 1)` | `{ ...One, ...Two, args: { ...One.args, a: 1 } }` |
| `const Base = { play: async () => {} };` | `{ ...Base, play: async (c) => { await Base.play(c); } }` | `set(['args', 'a'], 1)` | `{ ...Base, play: async (c) => { await Base.play(c); }, args: { a: 1 } }` |
| `const Base = { title: 'B' }; Base.args = { x: 1 };` | `{ ...Base }` | `set(['args', 'a'], 1)` | `{ ...Base, args: { ...Base.args, a: 1 } }` |
| `const Base = { title: 'B' }; mutate(Base);` | `{ ...Base }` | `set(['args', 'a'], 1)` | `{ ...Base, args: { ...Base.args, a: 1 } }` |
| `const Base = { setup() { this.args = { x: 1 }; } }; Base.setup();` | `{ ...Base }` | `set(['args', 'a'], 1)` | `{ ...Base, args: { ...Base.args, a: 1 } }` |
| `const Base = { async play() {} };` | `{ ...Base, play: async (c) => { await Base.play(c); } }` | `set(['args', 'a'], 1)` | `{ ...Base, play: async (c) => { await Base.play(c); }, args: { ...Base.args, a: 1 } }` |
| `const Base = { *[Symbol.iterator]() { this.args = undefined; }, args: {} }; [...Base];` | `{ ...Base }` | `set(['args', 'b', 'a'], 1)` | `{ ...Base, args: { ...Base.args, b: { ...Base.args?.b, a: 1 } } }` |
| `import shared from './shared';` | `{ ...shared }` | `append(['addons'], 'x')` | `{ ...shared, addons: [...(shared.addons ?? []), 'x'] }` |
| `import { Base } from './base';` | `{ ...Base, label: 'a' }` | `set(['label'], 'b')` | `{ ...Base, label: 'b' }` |
| `import { Base } from './base';` | `{ label: 'a', ...Base }` | `set(['label'], 'b')` | refused, `spread-field` |
| `import { Base } from './base';` | `{ args: {}, ...Base }` | `set(['args', 'a'], 1)` | refused, `spread-field` |
| `const Base = { title: 'B' };` | `{ args: { a: 1 }, ...Base }` | `set(['args', 'a'], 2)` | `{ args: { a: 2 }, ...Base }` |
| `const Base = { args: {} };` | `{ args: { a: 1 }, ...Base }` | `set(['args', 'a'], 2)` | refused, `spread-field` |
| `const Base = { title: 'B' }; Base.args = {};` | `{ args: { a: 1 }, ...Base }` | `set(['args', 'a'], 2)` | refused, `spread-field` |
| `import { Base } from './base';` | `{ ...Base, label: 'a' }` | `remove(['label'])` | refused, `spread-field` |
| `import { Base } from './base';` | `{ ...Base, label: 'a' }` | `rename(['label'], 'name')` | refused, `spread-field` |
| `const Base = { title: 'B' };` | `{ label: 'a', ...Base }` | `remove(['label'])` | `{ ...Base }` |
| `const Base = { title: 'B' }; type Base = typeof Base;` | `{ label: 'a', ...Base }` | `remove(['label'])` | `{ ...Base }` |
| `const Base = { label: 'b' };` | `{ label: 'a', ...Base }` | `remove(['label'])` | refused, `spread-field` |
| `const Base = { title: 'B' };` | `{ ...Base, label: 'a' }` | `remove(['label'])` | `{ ...Base }` |
| `const Base = { title: 'B' };` | `{ ...Base, label: 'a' }` | `rename(['label'], 'name')` | `{ ...Base, name: 'a' }` |
| `import { base } from './base';` | `{ label: 'a', args: { ...base } }` | `move(['label'], ['args', 'label'])` | refused, `spread-field` |
| `import { Base } from './base';` | `{ ...Base, a: 1, b: 2 }` | `group(['args'], ['a', 'b'])` | refused, `spread-field` |
| `import { Base } from './base';` | `{ ...Base, label: 'a' }` | `inspect(['label'])` | `value` |
| `import { Base } from './base';` | `{ label: 'a', ...Base }` | `inspect(['label'])` | `unreadable`, `spread-field` |
| `import { Base } from './base';` | `{ ...Base }` | `inspect(['args'])` | `unreadable`, `spread-field` |
| `const Base = { title: 'B' };` | `{ args: { a: 1 }, ...Base }` | `inspect(['args'])` | `value` |

A carried member is read again where the parent is created, so a getter or a binding reassigned in between can give another value than the spread did.
The spread's own member is read with `.`, as a story spreading a value that is not an object is broken already, and a deeper one with `?.`, as it may be missing, unless a trusted local object literal holds it as an object literal.
When more than one spread may provide the member, which one does depends on whether a later one has it as its own `undefined`, so creating the parent is refused.
Changing a field that a later spread or computed key could override is refused, and so is removing or renaming a field after them, which could reveal what they provide. A spread of a trusted local object literal known to lack the field is the exception: it neither overrides nor provides the field, so these edits and reads proceed (`group` still refuses any spread).
A local object literal is trusted for its own members only, not those of the objects it holds, and only when every reference to it reads it, as a type does: `typeof Base`, or `type Base` declaring its name.
An assignment, `Object.assign`, an alias or a call it is passed to makes it unknown. So does code that can run with `this` bound to it: an accessor, spreading it into an array or arguments, or a call of a member it does not hold as an arrow function.

For edits that no path addresses, `CsfFile.editor` and `ConfigFile.editor` are the file's `SourceEditor`, and `program` its current parse; `CsfFile.appendStatement(code)` adds a statement that `formatCsf` prints. A commit parses and indexes the file again. The underscored `_editor`, `_program` and `_appendStatement` are deprecated aliases.

`CsfFile.changed` is true once any mutation has been applied, which is the signal for whether the file needs to be written back.

Each mutation is applied on its own, and a refused one leaves the file as it was, also when its edit would leave a file the CSF indexer rejects (`invalid-csf`). To apply several as one, run them in `transaction(fn)` on `CsfFile` or `ConfigFile`: when `fn` throws, returns `false`, or any mutation in it returns `{ ok: false }`, every edit made in it is rolled back, and `changed` with it. Mutations inside return their results as usual, and the diagnostics of refused ones stay on `mutationDiagnostics`. `transaction` returns whether the edits were kept. `fn` runs synchronously; one that returns a promise throws. A transaction inside another rolls back on its own, and with the outer one.

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

`textOf` gives a node's source as written, and `placeableTextOf` that source ready to place as a value. `detachedTextOf` also dedents it as if the node's line had no indent, to place a value from a file at another indent, such as in a generated snippet. All three take the nodes of an editor's `program`, `parseExpression` and `parseModule`.

To read a tree, `walk` visits its nodes depth-first, `staticKey` reads an object member's key, `objectProperty(object, name)` finds a property by that key, `isIdentifier(node, name)` checks for an identifier and its name, and `locationOf(code, start, end)` gives the lines and columns of two offsets.

`editor.scopes` is the file's scope analysis: `scopes.program.bindings` maps each top-level name to its `Binding`, and `scopes.tsDeclarationNames` holds the top-level names of type aliases, interfaces, enums, namespaces and bodiless functions, which bind none. A binding's `references` holds the identifiers that read or write it, in code or in a type such as `typeof Button`, and statements too, as in Babel: the `export` statement of an exported declaration, and any TS declaration of the same name in scope, such as an overload signature, a `type`, an `interface`, an `enum` or a `namespace`, which counts through its `export` statement when it is exported. Filter on `type` when only identifiers count.

### Elements and arguments

A path is a list of keys and indexes. A string is a key of an object literal; a number is an item of the array or call the path reaches, an element or an argument, at its position in the source, where spreads and holes count. `printCsfPath` prints a path as diagnostics do, `parameters.msw.handlers[0]`, and a path of keys alone as `path.join('.')`.

For an array literal written at the field, that position is the index in `get(path).elements`, so a consumer finds an item with its own predicate and addresses it. `get` returns the expression as written, so for `const addons = [...]; export default { addons }` it returns the identifier, while `['addons', 0]` follows the constant to its first element.

```ts
// export default { addons: ['a', 'x'] }
const addons = main.get(['addons']);
const index =
  addons?.type === 'ArrayExpression'
    ? addons.elements.findIndex((element) => isStringLiteral(element) && element.value === 'x')
    : -1;
if (index >= 0) {
  main.remove(['addons', index]);
}
```

| Operation | On an element or argument |
| --- | --- |
| `get`, `getValue`, `inspect` | Read the item. Past the end of the list, or at a hole, it is missing. |
| `set`, `transform` | Replace the item in place, keeping the layout of the list; `set` fills a hole. `set` at an index the list lacks is refused (`unsupported-member`), and `transform` leaves it alone. |
| `remove` | Remove the one item, a hole with its slot. An emptied array stays `[]`, as `tags: []` is not a missing `tags`, and the cleanup of empty parents stops at an item. |
| `append`, `prepend` | `path` names the array, or the call at an item such as `['loaders', 0]`: add an item after its last one or before its first one. A missing array is created, carrying spreads forward like a missing parent. A field is a list only when it holds an array literal, so one holding anything else, a call included, is refused (`unsupported-value`). The first argument of an empty call hugs its parentheses: `mswLoader(async () => {…})`. |
| `rename`, `move`, `group` | Refuse an item as the source or the destination (`unsupported-member`). Indexes earlier in the path only navigate, so `rename(['loaders', 0, 'name'], 'id')` renames a member of the first loader. |

A number on a field that holds a call addresses the call's arguments, whatever the callee: on `addons: ['a', 'b'].filter(Boolean)`, `remove(['addons', 0])` removes `Boolean`. Check that the field is an array literal before editing its items. `append(['addons'], 'c')` refuses that field, as an argument of `filter` would add no addon.

A spread in a list shifts the positions after it but cannot shadow an item, so the items before and after it are edited as usual, and `append` and `prepend` leave it in place: `[...base.addons, 'x']`. The spread itself, addressed by its index, is unreadable and refused (`spread-field`), and `-1` from `findIndex` next to a spread means the source does not write the item, not that it is absent. Only keys create missing values; an index into an object, a key into a list, and an index that is not a non-negative integer are `unsupported-member`. Edits follow a constant only the edited object refers to, as for fields.

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

`appendValueToArray` and `appendNodeToArray` are deprecated: use `append`. `removeEntryFromArray`, deprecated too, removes the first entry of an array that names a value: a string, a `{ name }` object, or a call like `getAbsolutePath(value)`; find the entry's index and `remove([...path, index])` it instead, keeping in mind that `get(path)` returns the field as written. The three helpers edit the array literal the field resolves to, through local constants and type assertions, and return a `CsfMutationResult` like the editor operations. A field that is not an array literal, a call included, leaves the file as it is and adds an `unsupported-value` diagnostic; a missing field or entry is a no-op for `removeEntryFromArray`, unless a spread or a computed key leaves the field unproven. Like `append` and `remove`, they refuse an array that a later spread could replace, and one in a constant that other code refers to as well.

Discovery rejects shared or reassigned bindings, unresolved re-exports, and conditional or repeated CommonJS assignments. Inline object methods and exported function declarations can be transformed as function expressions while retaining their declaration form. Path edits use the same spread, duplicate-key, occupied-destination, and dynamic-value checks as story edits. Unsupported input produces diagnostics without rewriting that input.

## Editing imports

`CsfFile` and `ConfigFile` both have `setImport` and `removeImport`, and `ConfigFile` also `setRequireImport`. They look at every import or top-level `require` of the module, and take a named binding as `'name'` or `'name as alias'`. `setImport` and `setRequireImport` skip a binding the module already provides under that local name. A binding that only an `import type` provides becomes a value import; other type-only imports are left alone. `removeImport` removes every import of a plain name, whatever its local name, but only the matching import of an alias. Added statements follow the file's quotes and semicolons.

They return a `CsfMutationResult`, set `changed` when they edit the file, and roll back with the transaction they run in. A removal that leaves a story file the CSF indexer rejects, such as `export { Primary }` without the import of `Primary`, is refused with an `invalid-csf` diagnostic whose target is `{ kind: 'file' }`.

```ts
const csf = loadCsf(source, { makeTitle }).parse();
csf.setImport(['expect', 'userEvent'], 'storybook/test');
// import { expect, userEvent } from 'storybook/test';
```

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
