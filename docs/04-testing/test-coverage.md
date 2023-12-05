---
title: 'Test coverage'
---

<YouTubeCallout id="wEa6W8uUGSA" title="These tests use NO CODE | component testing in Storybook" />

Test coverage is the practice of measuring whether existing tests fully cover your code. That means surfacing areas which aren't currently being tested, such as: conditions, logic branches, functions and variables.

Coverage tests examine the instrumented code against a set of industry-accepted best practices. They act as the last line of QA to improve the quality of your test suite.

<video autoPlay muted playsInline loop>
  <source
    src="component-test-coverage-whitebg.mp4"
    type="video/mp4"
  />
</video>

## Code instrumentation with the coverage addon

Storybook provides an official [test coverage addon](https://storybook.js.org/addons/@storybook/addon-coverage). Powered by [Istanbul](https://istanbul.js.org/), which allows out-of-the-box code instrumentation for the most commonly used frameworks and builders in the JavaScript ecosystem.

### Set up the coverage addon

Engineered to work alongside modern testing tools (e.g., [Playwright](https://playwright.dev/)), the coverage addon automatically instruments your code and generates code coverage data. For an optimal experience, we recommend using the [test runner](./test-runner.md) alongside the coverage addon to run your tests.

Run the following command to install the addon.

<CodeSnippets
paths={[
'common/storybook-coverage-addon-install.yarn.js.mdx',
'common/storybook-coverage-addon-install.npm.js.mdx',
'common/storybook-coverage-addon-install.pnpm.js.mdx',
]}
/>

Update your Storybook configuration (in `.storybook/main.js|ts`) to include the coverage addon.

<CodeSnippets
paths={[
'common/storybook-coverage-addon-registration.js.mdx',
'common/storybook-coverage-addon-registration.ts.mdx',
]}
/>

Start your Storybook with:

<CodeSnippets
paths={[
'common/storybook-run-dev.yarn.js.mdx',
'common/storybook-run-dev.npm.js.mdx',
'common/storybook-run-dev.pnpm.js.mdx',
]}
/>

Finally, open a new terminal window and run the test-runner with:

<CodeSnippets
paths={[
'common/test-runner-coverage.yarn.js.mdx',
'common/test-runner-coverage.npm.js.mdx',
'common/test-runner-coverage.pnpm.js.mdx',
]}
/>

![Coverage test output](./test-runner-coverage-result.png)

### Configure

By default, the [`@storybook/addon-coverage`](https://storybook.js.org/addons/@storybook/addon-coverage) offers zero-config support for Storybook and instruments your code via [`babel-plugin-istanbul`](https://github.com/istanbuljs/babel-plugin-istanbul) for [Babel](https://babeljs.io/), or [`vite-plugin-istanbul`](https://github.com/iFaxity/vite-plugin-istanbul) for [Vite](https://vitejs.dev/). However, you can extend your Storybook configuration file (i.e., `.storybook/main.js|ts`) and provide additional options to the addon. Listed below are the available options and examples of how to use them.

<CodeSnippets
paths={[
'common/storybook-coverage-addon-config-options.js.mdx',
'common/storybook-coverage-addon-config-options.ts.mdx',
]}
/>

| Option                 | Description                                                                                                                                            | Plugin      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `cwd`                  | Defines the current working directory <br/>`options: { istanbul: { cwd: process.cwd(),}}`                                                              | Babel, Vite |
| `include`              | Select the files to collect coverage <br/>`options: { istanbul: { include: ['**/stories/**'],}}`                                                       | Babel, Vite |
| `exclude`              | Select the files to exclude from coverage <br/>`options: { istanbul: { exclude: ['**/stories/**'],}}`                                                  | Babel, Vite |
| `extension`            | Sets additional file extensions for coverage <br/>`options: { istanbul: { extension: ['.js', '.cjs', '.mjs'],}}`                                       | Babel, Vite |
| `nycrcPath`            | Defines the relative path for the existing nyc configuration file <br/>`options: { istanbul: { nycrcPath: '../nyc.config.js',}}`                       | Babel, Vite |
| `excludeNodeModules`   | Disables `node_modules` directory introspection <br/>`options: { istanbul: { excludeNodeModules:false,}}`                                              | Babel       |
| `ignoreClassMethods`   | Configures a set of method names to ignore from being collected <br/>`options: { istanbul: { ignoreClassMethods: ['example', 'myMethod'],}}`           | Babel       |
| `useInlineSourceMaps`  | Enables coverage collection on source maps <br/>`options: { istanbul: { useInlineSourceMaps: false,}}`                                                 | Babel       |
| `inputSourceMap`       | Sets the value to store the source map.<br/> Useful for instrumenting code programmatically <br/>`options: { istanbul: { inputSourceMap: sourceMap,}}` | Babel       |
| `onCover`              | Hook to monitor coverage collection for all tests <br/>`options: { istanbul: { onCover: (fileName, fileCoverage) => {},}}`                             | Babel       |
| `requireEnv`           | Overrides the `VITE_COVERAGE` environment variable's value by granting access to the `env` variables <br/>`options: { istanbul: { requireEnv: true,}}` | Vite        |
| `cypress`              | Replaces the `VITE_COVERAGE` environment variable with `CYPRESS_COVERAGE`. <br/>Requires Cypress <br/>`options: { istanbul: { cypress: true,}}`        | Vite        |
| `checkProd`            | Configures the plugin to skip instrumentation in production environments <br/>`options: { istanbul: { checkProd: true,}}`                              | Vite        |
| `forceBuildInstrument` | Configures the plugin to add instrumentation in build mode <br/>`options: { istanbul: { forceBuildInstrument: true,}}`                                 | Vite        |

<Callout variant="info">

Including the `nycrcPath` option enables use of an existing `nyc` configuration file with additional options like [coverage thresholds](https://github.com/istanbuljs/nyc#coverage-thresholds). For more information, refer to the [`nyc` documentation](https://github.com/istanbuljs/nyc#common-configuration-options).

</Callout>

## What about other coverage reporting tools?

Out of the box, code coverage tests work seamlessly with Storybook's test-runner and the [`@storybook/addon-coverage`](https://storybook.js.org/addons/@storybook/addon-coverage). However, that doesn't mean you can't use additional reporting tools (e.g., [Codecov](https://about.codecov.io/)). For instance, if you're working with [LCOV](https://wiki.documentfoundation.org/Development/Lcov), you can use the generated output (in `coverage/storybook/coverage-storybook.json`) and create your own report with:

<CodeSnippets
paths={[
'common/storybook-coverage-report-lcov.js.mdx',
]}
/>

---

## Troubleshooting

### Run test coverage in other frameworks

If you intend on running coverage tests in frameworks with special files like Vue or Svelte, you'll need to adjust your configuration and enable the required file extensions. For example, if you're using Vue, you'll need to add the following to your nyc configuration file (i.e., `.nycrc.json` or `nyc.config.js`):

<CodeSnippets
paths={[
'common/storybook-coverage-report-vue.json.mdx',
'common/storybook-coverage-report-vue.js.mdx',
]}
/>

### The coverage addon doesn't support instrumented code

As the [coverage addon](https://storybook.js.org/addons/@storybook/addon-coverage) is based on Babel and Vite plugins for code instrumentation, frameworks that don't rely upon these libraries (e.g., Angular configured with Webpack), will require additional configuration to enable code instrumentation. In that case, you can refer to the following [repository](https://github.com/yannbf/storybook-coverage-recipes) for more information.

#### Learn about other UI tests

- [Test runner](./test-runner.md) to automate test execution
- [Visual tests](./visual-testing.md) for appearance
- [Accessibility tests](./accessibility-testing.md) for accessibility
- [Interaction tests](./interaction-testing.md) for user behavior simulation
- Coverage tests for measuring code coverage
- [Snapshot tests](./snapshot-testing.md) for rendering errors and warnings
- [End-to-end tests](./stories-in-end-to-end-tests.md) for simulating real user scenarios
- [Unit tests](./stories-in-unit-tests.md) for functionality
