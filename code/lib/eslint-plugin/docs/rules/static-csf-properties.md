# CSF properties that Storybook reads statically must be analyzable (static-csf-properties)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>csf</li><li>flat/csf</li><li>recommended</li><li>flat/recommended</li><li>csf-strict</li><li>flat/csf-strict</li></ul>
<!-- RULE-CATEGORIES:END -->

## Rule Details

Storybook builds its index (the sidebar, story URLs, and tag filtering) by analyzing story files statically, without executing them. A handful of CSF properties therefore must be written so the indexer can read them from the AST:

- `title`, `id`, `tags`, `includeStories`, and `excludeStories` on the meta (the default export, or the `preview.meta()` call in CSF factories)
- `tags` on individual stories

A dynamic value — a function call, a template literal, an imported constant — makes the whole file fail to index, or silently diverge from what renders at runtime. This rule reports exactly the forms the indexer cannot read:

- dynamic values for the properties above (a local top-level `const` holding a literal is fine for `title` and `tags`, matching the indexer)
- statically-read properties placed _before_ an object spread, where the spread can override them at runtime while the indexer still reads the literal
- quoted or computed keys for these properties, which the indexer silently ignores or misreads
- a `preview.meta(...)` argument that is not an inline object literal (or a local `const` holding one), which the indexer treats as an empty meta
- a `preview.meta()` factory whose `preview` import does not point at a `.storybook/preview` file

Examples of **incorrect** code for this rule:

```js
import { titles } from './titles';

export default {
  title: titles.button, // dynamic: not readable statically
  id: `button-${suffix}`, // dynamic
  tags: getTags(), // dynamic
  includeStories: allowed, // identifiers are not supported here
};
```

```js
export default {
  title: 'Button', // read statically, but baseMeta may override it at runtime
  ...baseMeta,
};
```

```js
import preview from './preview'; // not a .storybook/preview file

const meta = preview.meta(generateMeta());
```

Examples of **correct** code for this rule:

```js
const TITLE = 'Atoms/Button';

export default {
  title: TITLE, // top-level const holding a string literal
  tags: ['autodocs'],
  includeStories: /^Primary/,
};
```

```js
export default {
  ...baseMeta,
  title: 'Button', // after the spread: the static value is also the runtime value
};
```

```js
import preview from '../../.storybook/preview';

const meta = preview.meta({ component: Button, tags: ['autodocs'] });

export const Primary = meta.story({ tags: ['!autodocs'] });
```

## When Not To Use It

If a story file is deliberately excluded from Storybook's index (for example, generated code never matched by your `stories` globs), this rule has nothing to protect and can be disabled for that file.

## Further Reading

- [Writing stories: how story titles are analyzed](https://storybook.js.org/docs/writing-stories#default-export)
- [Naming components and hierarchy](https://storybook.js.org/docs/writing-stories/naming-components-and-hierarchy)
