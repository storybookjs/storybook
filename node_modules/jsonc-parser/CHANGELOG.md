3.3.0 2022-06-24
=================
- `JSONVisitor.onObjectBegin` and `JSONVisitor.onArrayBegin` can now return `false` to instruct the visitor that no children should be visited.


3.2.0 2022-08-30
=================
- update the version of the bundled Javascript files to `es2020`.
- include all `const enum` values in the bundled JavaScript files (`ScanError`, `SyntaxKind`, `ParseErrorCode`).

3.1.0 2022-07-07
==================
  * added new API `FormattingOptions.keepLines` : It leaves the initial line positions in the formatting.

3.0.0 2020-11-13
==================
  * fixed API spec for `parseTree`. Can return `undefine` for empty input.
  * added new API `FormattingOptions.insertFinalNewline`.


2.3.0 2020-07-03
==================
  * new API `ModificationOptions.isArrayInsertion`: If `JSONPath` refers to an index of an array and `isArrayInsertion` is `true`, then `modify` will insert a new item at that location instead of overwriting its contents.
  * `ModificationOptions.formattingOptions` is now optional. If not set, newly inserted content will not be formatted.


2.2.0 2019-10-25
==================
  * added `ParseOptions.allowEmptyContent`. Default is `false`.
  * new API `getNodeType`: Returns the type of a value returned by parse.
  * `parse`: Fix issue with empty property name

2.1.0 2019-03-29
==================
 * `JSONScanner` and `JSONVisitor` return lineNumber / character.

2.0.0 2018-04-12
==================
  * renamed `Node.columnOffset` to `Node.colonOffset`
  * new API `getNodePath`: Gets the JSON path of the given JSON DOM node
  * new API `findNodeAtOffset`: Finds the most inner node at the given offset. If `includeRightBound` is set, also finds nodes that end at the given offset.

1.0.3 2018-03-07
==================
  * provide ems modules

1.0.2 2018-03-05
==================
  * added the `visit.onComment` API, reported when comments are allowed.
  * added the `ParseErrorCode.InvalidCommentToken` enum value, reported when comments are disallowed.

1.0.1
==================
  * added the `format` API: computes edits to format a JSON document.
  * added the `modify` API: computes edits to insert, remove or replace a property or value in a JSON document.
  * added the `allyEdits` API: applies edits to a document

1.0.0
==================
 * remove nls dependency (remove `getParseErrorMessage`)

0.4.2 / 2017-05-05
==================
 * added `ParseError.offset` & `ParseError.length`

0.4.1 / 2017-04-02
==================
 * added `ParseOptions.allowTrailingComma`

0.4.0 / 2017-02-23
==================
  * fix for `getLocation`. Now `getLocation` inside an object will always return a property from inside that property. Can be empty string if the object has no properties or if the offset is before a actual property  `{ "a": { | }} will return location ['a', ' ']`

0.3.0 / 2017-01-17
==================
  * Updating to typescript 2.0