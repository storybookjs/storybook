<h1>Source Loader</h1>

Storybook `source-loader` is a webpack loader that annotates Storybook story files with their source code. It powers the [storysource](https://github.com/storybookjs/storybook/tree/next/code/addons/storysource) and [docs](https://github.com/storybookjs/storybook/tree/next/code/addons/docs) addons.

- [Options](#options)
  - [parser](#parser)
  - [prettierConfig](#prettierconfig)
  - [uglyCommentsRegex](#uglycommentsregex)
  - [injectDecorator](#injectdecorator)

## Options

The loader can be customized with the following options:

### parser

The parser that will be parsing your code to AST (based on [prettier](https://github.com/prettier/prettier/tree/master/src/language-js))

Allowed values:

- `javascript` - default
- `typescript`
- `flow`

Be sure to update the regex test for the webpack rule if utilizing Typescript files.

Usage:

```js
module.exports = function ({ config }) {
  config.module.rules.push({
    test: /\.stories\.tsx?$/,
    use: [
      {
        loader: require.resolve('@storybook/source-loader'),
        options: { parser: 'typescript' },
      },
    ],
    enforce: 'pre',
  });

  return config;
};
```

### prettierConfig

The prettier configuration that will be used to format the story source in the addon panel.

Defaults:

```js
{
  printWidth: 100,
  tabWidth: 2,
  bracketSpacing: true,
  trailingComma: 'es5',
  singleQuote: true,
}
```

Usage:

```js
module.exports = function ({ config }) {
  config.module.rules.push({
    test: /\.stories\.jsx?$/,
    use: [
      {
        loader: require.resolve('@storybook/source-loader'),
        options: {
          prettierConfig: {
            printWidth: 100,
            singleQuote: false,
          },
        },
      },
    ],
    enforce: 'pre',
  });

  return config;
};
```

### uglyCommentsRegex

The array of regex that is used to remove "ugly" comments.

Defaults:

```js
[/^eslint-.*/, /^global.*/];
```

Usage:

```js
module.exports = function ({ config }) {
  config.module.rules.push({
    test: /\.stories\.jsx?$/,
    use: [
      {
        loader: require.resolve('@storybook/source-loader'),
        options: {
          uglyCommentsRegex: [/^eslint-.*/, /^global.*/],
        },
      },
    ],
    enforce: 'pre',
  });

  return config;
};
```

### injectDecorator

Tell storysource whether you need inject decorator. If false, you need to add the decorator by yourself;

Defaults: true

Usage:

```js
module.exports = function ({ config }) {
  config.module.rules.push({
    test: /\.stories\.jsx?$/,
    use: [
      {
        loader: require.resolve('@storybook/source-loader'),
        options: { injectDecorator: false },
      },
    ],
    enforce: 'pre',
  });

  return config;
};
```
