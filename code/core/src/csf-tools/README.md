# Storybook CSF Tools

An experimental library to read, analyze, transform, and write CSF programmatically.

- Read - Parse a CSF file with Babel
- Analyze - Extract its metadata & stories based on the Babel AST
- Transform - Edit meta, story, and annotation objects through `CsfFile.objects()`
- Write - Write the AST back to a file

It can parse MDX into CSF.

## Transforming stories

`CsfFile.objects()` returns one `CsfObject` editor per mutable object it can prove safe to edit: the meta, each story export, and each CSF2 `Story.parameters` / `Story.story` annotation assignment.
`{ meta, stories, annotations }` narrows what is discovered; meta and stories are included by default, annotations only when listed.

Each editor reads and writes static property paths with `get`, `set`, `transform`, `remove`, `rename`, and `move`.
Successful removals and moves recursively remove empty source parents, stopping at the editor's root object. Moves clean up after inserting the destination, so shared ancestors remain intact. Unrelated empty objects are preserved.
Nodes reused by `transform` keep their original source, so relocating a value prints it as written instead of pretty-printing it.
Annotation editors take the same paths as their story counterparts, so `['parameters', 'a11y']` addresses `Story.parameters.a11y` and an inline `parameters.a11y` alike.

Discovery and mutation are conservative: an object or a path whose shape cannot be proven is left untouched, and the reason is reported on `CsfFile.mutationDiagnostics` as a `CsfMutationDiagnostic`.
Unproven shapes include story or meta bindings that are reassigned or aliased, a CSF factory configuration that is not an object literal owned by that single factory call, dynamically computed annotation names, and target paths shadowed by a spread, a duplicate field, or a computed key.

`CsfFile.changed` is true once any mutation has been applied, which is the signal for whether the file needs to be written back.
