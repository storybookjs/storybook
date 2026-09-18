## Table of Contents

- [About the project](#about-the-project)
- [Getting started](#getting-started)
  - [Creating a new rule](#creating-a-new-rule)
    - [Important metadata for a rule](#important-metadata-for-a-rule)
  - [Testing rules](#testing-rules)
  - [Updating configs or documentation](#updating-configs-or-documentation)
  - [Useful resources](#useful-resources)

# About the project

The ESLint plugin for Storybook aims to help steer developers into using the best practices when writing their stories. The rules should be auto-fixable when possible, to improve the developer experience as much as we can.

# Getting started

First of all, thank you so much for taking the time to contribute to this project.

### Creating a new rule

Run the following command and answer the prompts:

```sh
yarn generate-rule
```

This command will generate the rule file, tests as well as the documentation page.
The generated files will look like this:

```
docs/rules/<rule-name>.md
src/rules/<rule-name>.js
tests/rules/<rule-name>.js
```

This command will auto-generate the test file with an example for you. Please refer to existing tests if more reference is needed.

#### Important metadata for a rule

```js
import { CategoryId } from '../utils/constants';

module.exports = {
  meta: {
    severity: 'error', // whether the rule should yield 'warn' or 'error'
    docs: {
      categories: [CategoryId.RECOMMENDED], // You should always use an existing category from the CategoryId enum], or create a new one there
      excludeFromConfig: true, // If the rule is not ready to be shipped in any category, set this flag to true, otherwise remove it
    },
  },
  ...otherProperties,
};
```

### Testing rules

Run the following command for testing the rules:

```sh
yarn test
```

If you want to run tests for a particular rule and skip the rest, you can do so like this:

```js
ruleTester.run('my-rule-name', rule, {
  valid: [
    'export default { component: Button }',
  ],

  invalid: [
    {
      only: true, // <-- Add this property, which is equivalent to it.only in jest
      code: "export default { title: 'Button', component: Button }",
      errors: [ ... ],
    },
  ]
})
```

### Updating configs or documentation

When you make changes to rules or create/delete rules, the configuration files and documentation have to be updated. For that, run the following command:

```sh
yarn update-rules
```

or rebuild the package:

```sh
nx build eslint-plugin
```

### Useful resources

- The [ESLint official developer guide](https://eslint.org/docs/developer-guide/working-with-rules) can be useful to assist when writing rules
- The [AST Explorer](https://astexplorer.net/) website is the perfect place to get reference to writing rules. Given that ESLint rules are based in AST (Abstract Syntax Tree), you can paste an example code there and visualize all properties of the resulting AST of that code.
- Storybook has a discord community! And we need more people like you. Please [join us](https://discord.gg/storybook) and say hi in the [#contributing](https://discord.com/channels/486522875931656193/839297503446695956) channel! 👋
