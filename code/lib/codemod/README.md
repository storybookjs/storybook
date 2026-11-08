# Storybook Codemods

Storybook Codemods is a collection of codemod scripts to help you migrate breaking changes and deprecations.

## CLI Integration

Run these codemods with the CLI's `migrate` command.

To get a list of available codemods:

```
npx sb migrate --list
```

To run a codemod `<name-of-codemod>`:

```
npx sb migrate <name-of-codemod> --glob="**/*.stories.js"
```

## Transforms

### upgrade-hierarchy-separators

Starting in 5.3, Storybook is moving to using a single path separator, `/`, to specify the story hierarchy. It previously defaulted to `|` for story "roots" (optional) and either `/` or `.` for denoting paths. This codemod updates the old default to the new default.

```sh
npx sb migrate upgrade-hierarchy-separators --glob="**/*.stories.js"
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

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
