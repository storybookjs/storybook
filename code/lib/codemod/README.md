# Storybook Codemods

Storybook Codemods is a collection of codemod scripts written with JSCodeshift.
It will help you migrate breaking changes & deprecations.

## CLI Integration

The preferred way to run these codemods is via the CLI's `migrate` command.

To get a list of available codemods:

```
npx sb migrate --list
```

To run a codemod `<name-of-codemod>`:

```
npx sb migrate <name-of-codemod> --glob="**/*.stories.js"
```

## Installation

If you want to run these codemods by hand:

```sh
yarn add jscodeshift @storybook/codemod --dev
```

- `@storybook/codemod` is our collection of codemod scripts.
- `jscodeshift` is a tool we use to apply our codemods.

After running the migration commands, you can remove them from your `package.json`, if you added them.

## How to run a codemod script

From the directory where you installed both `jscodeshift` and `@storybook/codemod` run:

Example:

```sh
./node_modules/.bin/jscodeshift -t ./node_modules/@storybook/codemod/dist/transforms/upgrade-hierarchy-separators.js . --ignore-pattern "node_modules|dist"
```

Explanation:

    <jscodeShiftCommand> -t <transformFileLocation> <pathToSource> --ignore-pattern "<globPatternToIgnore>"

## Transforms

### upgrade-hierarchy-separators

Starting in 5.3, Storybook is moving to using a single path separator, `/`, to specify the story hierarchy. It previously defaulted to `|` for story "roots" (optional) and either `/` or `.` for denoting paths. This codemod updates the old default to the new default.

```sh
./node_modules/.bin/jscodeshift -t ./node_modules/@storybook/codemod/dist/transforms/upgrade-hierarchy-separators.js . --ignore-pattern "node_modules|dist"
```

For example:

```js
storiesOf('Foo|Bar/baz');
storiesOf('Foo.Bar.baz');

export default {
  title: 'Foo|Bar/baz.whatever',
};
```

Becomes:

```js
storiesOf('Foo/Bar/baz');
storiesOf('Foo/Bar/baz');

export default {
  title: 'Foo/Bar/baz/whatever',
};
```

### csf-hoist-story-annotations

Starting in 6.0, Storybook has deprecated the `.story` annotation in CSF and is using hoisted annotations.

```sh
./node_modules/.bin/jscodeshift -t ./node_modules/@storybook/codemod/dist/transforms/csf-hoist-story-annotations.js . --ignore-pattern "node_modules|dist" --extensions=js
```

For example:

```js
export const Basic = () => <Button />
Basic.story = {
  name: 'foo',
  parameters: { ... },
  decorators: [ ... ],
};
```

Becomes:

```js
export const Basic = () => <Button />
Basic.storyName = 'foo';
Basic.parameters = { ... };
Basic.decorators = [ ... ];
```

The new syntax is slightly more compact, is more ergonomic, and resembles React's `displayName`/`propTypes`/`defaultProps` annotations.
