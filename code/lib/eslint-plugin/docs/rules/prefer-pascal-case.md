# Prefer pascal case for story names (prefer-pascal-case)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

As a best practice, stories should be defined in [_PascalCase_](https://en.wiktionary.org/wiki/Pascal_case). This makes it easier to differentiate stories from other code visually. Plus, it makes it simpler to define regexes for [non-story exports](https://storybook.js.org/docs/api/csf#non-story-exports).

Examples of **incorrect** code for this rule:

```js
export const primaryButton = {};
```

Examples of **correct** code for this rule:

```js
export const PrimaryButton = {};
```

## Further Reading

More information about naming stories can be found here: https://storybook.js.org/docs/writing-stories#defining-stories
