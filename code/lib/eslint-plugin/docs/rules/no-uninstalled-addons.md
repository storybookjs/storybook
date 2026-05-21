# no-uninstalled-addons

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule checks if all addons registered in `.storybook/main.js|ts` are properly listed in the root `package.json` of your project.

For instance, if the `@storybook/addon-links` is in the `.storybook/main.js|ts` file but is not listed in the project's `package.json`, this rule will notify the user to install it.

As an important side note, this rule checks for the `package.json` file at the **root level** of your project. You can customize the location of the `package.json` by [setting the `packageJsonLocation` option](#configure).

Another very important side note: your ESLint config must allow linting the `.storybook` folder. By default, ESLint ignores all dot-files, so this folder will be ignored. To allow this rule to lint the `.storybook/main.js` file, it's essential to configure ESLint to lint this file. This can be achieved by writing something like:

```
// Inside your .eslintignore file
!.storybook
```

For more info, check this [ESLint documentation](https://eslint.org/docs/latest/use/configure/ignore-deprecated#:~:text=In%20addition%20to,contents%20are%20ignored).

Examples of **incorrect** code for this rule:

```js
// in .storybook/main.js
module.exports = {
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-a11y', // <-- this addon is not listed in the package.json
  ],
}

// package.json
{
  "devDependencies": {
    "@storybook/addon-links": "0.0.1",
    "@storybook/addon-a11y": "0.0.1",
  }
}
```

Examples of **correct** code for this rule:

```js
// in .storybook/main.js
module.exports = {
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-a11y',
  ],
}

// package.json
{
  "devDependencies": {
    "@storybook/addon-links": "0.0.1",
    "@storybook/addon-a11y": "0.0.1"
  }
}
```

### Configure

#### `packageJsonLocation`

This rule assumes that the `package.json` is located in the root of your project. You can customize this by setting the `packageJsonLocation` option of the rule:

```js
module.exports = {
  rules: {
    'storybook/no-uninstalled-addons': ['error', { packageJsonLocation: './folder/package.json' }],
  },
};
```

Note that the path must be relative to the location from which ESLint runs, which is typically the root of the project.

#### `ignore`

You can also ignore specific addons by providing an ignore array in the options:

```js
module.exports = {
  rules: {
    'storybook/no-uninstalled-addons': [
      'error',
      {
        packageJsonLocation: './folder/package.json',
        ignore: ['custom-addon'],
      },
    ],
  },
};
```

### What if I use a different Storybook config directory?

Some Storybook folders use a different name for their config directory other than `.storybook`. This rule will not be applied there by default. If you have a custom location for your Storybook config directory, then you must add an override in your `.eslintrc.js` file, defining your config directory:

```js
{
  overrides: [
      {
        files: ['your-config-dir/main.@(js|cjs|mjs|ts)'],
        rules: {
          'storybook/no-uninstalled-addons': 'error'
        },
      },
    ],
}
```

## When Not To Use It

This rule is convenient to use because if the user tries to start Storybook but has forgotten to install the plugin, Storybook will throw very unusual errors that provide no clue to the user about what's going wrong. To prevent that, this rule should always be on.

## Further Reading

Check the issue in GitHub: [https://github.com/storybookjs/eslint-plugin-storybook/issues/95](https://github.com/storybookjs/eslint-plugin-storybook/issues/95)
