---
title: 'Snapshot testing with Storyshots'
---

Snapshot tests compare the rendered markup of every story against known baselines. It’s a way to identify markup changes that trigger rendering errors and warnings.

Storybook is a helpful tool for snapshot testing because every story is essentially a test specification. Any time you write or update a story, you get a snapshot test for free.

![Example Snapshot test](./snapshot-test.png)

## Migrating Tests

The Storyshots addon was the original testing solution for Storybook, offering a highly extensible API and a wide range of configuration options for testing. However, it was difficult to set up and maintain, and it needed to be compatible with the latest version of Storybook, which introduced some significant architectural changes, including a high-performance [on-demand story loading](../configure/index.md#on-demand-story-loading) feature. As a result, Storyhots is now officially deprecated, is no longer being maintained, and will be removed in the next major release of Storybook. We recommend following the [migration guide](./storyshots-migration-guide.md) we've prepared to help you during this transition period.

## Set up Storyshots

<Callout variant="warning">

The Storyshots addon has been deprecated and will be removed in a future release of Storybook. See the [migration guide](./storyshots-migration-guide.md) for more information.

</Callout>

[Storyshots](https://storybook.js.org/addons/@storybook/addon-storyshots/) is a Storybook addon that enables snapshot testing, powered by [Jest](https://jestjs.io/docs/getting-started).

Run the following command to install Storyshots:

<CodeSnippets
paths={[
'common/storybook-addon-storyshots-install.yarn.js.mdx',
'common/storybook-addon-storyshots-install.npm.js.mdx',
]}
/>

Add a test file to your environment with the following contents to configure Storyshots:

<CodeSnippets
paths={[
'common/storybook-storyshots-config.js.mdx',
]}
/>

<Callout variant="info" icon="💡">

You can name the test file differently to suit your needs. Bear in mind that it requires to be picked up by Jest.

</Callout>

Run your first test. Storyshots will recognize your stories (based on [.storybook/main.js's setup](../configure/story-rendering.md)) and save them in the **snapshots** directory.

```shell
npm test storybook.test.js
```

![Successful snapshot tests](./storyshots-pass.png)

When you make changes to your components or stories, rerun the test to identify the changes to the rendered markup.

![Failing snapshots](./storyshots-fail.png)

If they're intentional, accept them as new baselines. If the changes are bugs, fix the underlying code, then rerun the snapshot tests.

### Configure the snapshot's directory

If your project has a custom setup for snapshot testing, you'll need to take additional steps to run Storyshots. You'll need to install both [@storybook/addon-storyshots-puppeteer](https://storybook.js.org/addons/@storybook/addon-storyshots-puppeteer) and [puppeteer](https://github.com/puppeteer/puppeteer):

```shell
# With npm
npm i -D @storybook/addon-storyshots-puppeteer puppeteer

# With yarn
yarn add @storybook/addon-storyshots-puppeteer puppeteer
```

Next, update your test file (for example, `storybook.test.js`) to the following:

<CodeSnippets
paths={[
'common/storybook-storyshots-custom-directory.js.mdx',
]}
/>

<Callout variant="info" icon="💡">

Don't forget to replace your-custom-directory with your own.

</Callout>

When you run your tests, the snapshots will be available in your specified directory.

### Framework configuration

By default, Storyshots detects your project's framework. If you encounter a situation where this is not the case, you can adjust the configuration object and specify your framework. For example, if you wanted to configure the addon for a Vue 3 project:

<CodeSnippets
paths={[
'common/storybook-storyshots-custom-framework.js.mdx',
]}
/>

These are the frameworks currently supported by Storyshots: `angular`, `html`, `preact`, `react`, `react-native`, `svelte`, `vue`, `vue3`, and `web-components`.

### Additional customization

Storyshots is highly customizable and includes options for various advanced use cases. You can read more in the [addon’s documentation](https://github.com/storybookjs/storybook/tree/master/addons/storyshots/storyshots-core#options).

---

#### What’s the difference between snapshot tests and visual tests?

Visual tests capture images of stories and compare them against image baselines. Snapshot tests take DOM snapshots and compare them against DOM baselines. Visual tests are better suited for verifying appearance. Snapshot tests are useful for smoke testing and ensuring the DOM doesn’t change.

#### Learn about other UI tests

- [Test runner](./test-runner.md) to automate test execution
- [Visual tests](./visual-testing.md) for appearance
- [Accessibility tests](./accessibility-testing.md) for accessibility
- [Interaction tests](./interaction-testing.md) for user behavior simulation
- [Coverage tests](./test-coverage.md) for measuring code coverage
- Snapshot tests for rendering errors and warnings
- [End-to-end tests](./stories-in-end-to-end-tests.md) for simulating real user scenarios
- [Unit tests](./stories-in-unit-tests.md) for functionality
