# QA examples for static CSF analysis rules

Each `*.stories.js` file in this folder demonstrates exactly one problem that the
`eslint-plugin-storybook` rules catch around Storybook's static analysis of CSF files —
dynamic values in statically-read properties, index/runtime divergences, and the CSF4
factory equivalents. The two `valid-*`-style files (`04`, `22`) show the compliant
counterparts and report nothing.

These files are demo fixtures: they are excluded from the repository's own linting,
type checking, and the internal Storybook, and are not published with the package.

## Running the demo

```bash
cd code/lib/eslint-plugin
yarn prep            # build ../dist, which eslint.config.mjs imports
cd qa-examples
npx eslint .         # ESLint 9+; for ESLint 8.57 add ESLINT_USE_FLAT_CONFIG=true
```

The config applies the plugin's `flat/recommended` preset plus `storybook/csf-component`
(which lives in the `flat/csf` preset) so its CSF4 coverage shows up too.

## What each file shows

| File                                   | Rule                              | Reported problem                                                       |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `01-dynamic-title.stories.js`          | `static-csf-properties` (error)   | `title` from a function call — file fails to index                     |
| `02-template-literal-title.stories.js` | `static-csf-properties` (error)   | Template literal `title`, even without interpolation                   |
| `03-imported-title.stories.js`         | `static-csf-properties` (error)   | `title` from an import — only same-file constants resolve              |
| `04-local-constant-title.stories.js`   | — (valid)                         | Top-level `const` string titles are fine                               |
| `05-dynamic-id.stories.js`             | `static-csf-properties` (error)   | `id` accepts only inline literals, not constants                       |
| `06-dynamic-tags.stories.js`           | `static-csf-properties` (error)   | Tags built with a spread element                                       |
| `07-dynamic-include-stories.stories.js`| `static-csf-properties` (error)   | `includeStories` via identifier                                        |
| `08-static-before-spread.stories.js`   | `static-csf-properties` (error)   | Static `title` before a spread — index/runtime divergence              |
| `09-quoted-key.stories.js`             | `static-csf-properties` (error)   | `'title':` quoted key is silently ignored by the indexer               |
| `10-computed-key.stories.js`           | `static-csf-properties` (error)   | Computed key misread as a static property                              |
| `11-story-dynamic-tags.stories.js`     | `static-csf-properties` (error)   | Dynamic tags on a story                                                |
| `12-story-tags-before-spread.stories.js`| `static-csf-properties` (error)  | Story tags before a spread                                             |
| `13-csf4-dynamic-title.stories.js`     | `static-csf-properties` (error)   | Dynamic `title` inside `preview.meta()`                                |
| `14-csf4-unresolvable-meta.stories.js` | `static-csf-properties` (error)   | `preview.meta()` argument the indexer cannot resolve                   |
| `15-csf4-wrong-preview-import.stories.js`| `static-csf-properties` (error) | `preview` imported from a non-preview path                             |
| `16-csf4-story-dynamic-tags.stories.js`| `static-csf-properties` (error)   | Dynamic tags on `meta.story()`                                         |
| `17-csf4-missing-component.stories.js` | `csf-component` (warn)            | Factory meta without `component`                                       |
| `18-csf4-title-separator.stories.js`   | `hierarchy-separator` (warn)      | Deprecated `|` separator in a factory meta title                       |
| `19-csf4-no-story-exports.stories.js`  | `story-exports` (error)           | Factory file whose only export is not a `meta.story()`                 |
| `20-csf4-lowercase-story.stories.js`   | `prefer-pascal-case` (warn)       | Lowercase factory story export                                         |
| `21-csf4-redundant-name.stories.js`    | `no-redundant-story-name` (warn)  | Factory story `name` matching its export name                          |
| `22-valid-csf4.stories.js`             | — (valid)                         | Fully compliant CSF4 file                                              |
