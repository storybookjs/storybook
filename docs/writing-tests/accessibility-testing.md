---
title: 'Accessibility tests'
---

<YouTubeCallout id="rNLL0SICr9w" title="STOP fighting accessibility | automate a11y checks" />

Accessibility is the practice of making websites inclusive to all. That means supporting requirements such as: keyboard navigation, screen reader support, touch-friendly, usable color contrast, reduced motion, and zoom support.

Accessibility tests audit the rendered DOM against a set of heuristics based on [WCAG](https://www.w3.org/WAI/standards-guidelines/wcag/) rules and other industry-accepted best practices. They act as the first line of QA to catch blatant accessibility violations.

<video autoPlay muted playsInline loop>
  <source
    src="component-accessibility-testing.mp4"
    type="video/mp4"
  />
</video>

## Accessibility checks with a11y addon

Storybook provides an official [a11y addon](https://storybook.js.org/addons/@storybook/addon-a11y). Powered by Deque's [axe-core](https://github.com/dequelabs/axe-core), which automatically catches up to [57% of WCAG issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/).

### Set up the a11y addon

If you want to check accessibility for your stories using the [addon](https://storybook.js.org/addons/@storybook/addon-a11y/), you'll need to install it and add it to your Storybook.

Run the following command to install the addon.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-a11y-install.yarn.js.mdx',
    'common/storybook-a11y-install.npm.js.mdx',
    'common/storybook-a11y-install.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Update your Storybook configuration (in `.storybook/main.js|ts`) to include the accessibility addon.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-a11y-register.js.mdx',
    'common/storybook-a11y-register.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Start your Storybook, and you will see some noticeable differences in the UI. A new toolbar icon and the accessibility panel where you can inspect the results of the tests.

![Storybook accessibility addon running](./storybook-a11y-addon-optimized.png)

### How it works

Storybook's a11y addon runs [Axe](https://github.com/dequelabs/axe-core) on the selected story. Allowing you to catch and fix accessibility issues during development. For example, if you’re working on a button component and included the following set of stories:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/component-story-with-accessibility.js.mdx',
    'react/component-story-with-accessibility.ts.mdx',
    'angular/component-story-with-accessibility.ts.mdx',
    'vue/component-story-with-accessibility.2.js.mdx',
    'vue/component-story-with-accessibility.2.ts.mdx',
    'vue/component-story-with-accessibility.3.js.mdx',
    'vue/component-story-with-accessibility.3.ts.mdx',
    'svelte/component-story-with-accessibility.js.mdx',
    'svelte/component-story-with-accessibility.ts.mdx',
    'web-components/component-story-with-accessibility.js.mdx',
    'web-components/component-story-with-accessibility.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-tests/accessibility-testing#snippet-component-story-with-accessibility"
/>

<!-- prettier-ignore-end -->

Cycling through both stories, you will see that the `Inaccessible` story contains some issues that need fixing. Opening the violations tab in the accessibility panel provides a clear description of the accessibility issue and guidelines for solving it.

![Storybook accessibility addon running](./storybook-a11y-addon-optimized.png)

### Configure

Out of the box, Storybook's accessibility addon includes a set of accessibility rules that cover most issues. You can also fine-tune the [addon configuration](https://github.com/storybookjs/storybook/tree/next/code/addons/a11y#parameters) or override [Axe's ruleset](https://github.com/storybookjs/storybook/tree/next/code/addons/a11y#handling-failing-rules) to best suit your needs.

#### Global a11y configuration

If you need to dismiss an accessibility rule or modify its settings across all stories, you can add the following to your [`storybook/preview.js|ts`](../configure/index.md#configure-story-rendering):

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-addon-a11y-global-config.js.mdx',
    'common/storybook-addon-a11y-global-config.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

#### Component-level a11y configuration

You can also customize your own set of rules for all stories of a component. Update your story's default export and add a parameter with the required configuration:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'angular/storybook-addon-a11y-component-config.ts.mdx',
    'web-components/storybook-addon-a11y-component-config.js.mdx',
    'web-components/storybook-addon-a11y-component-config.ts.mdx',
    'common/storybook-addon-a11y-component-config.js.mdx',
    'common/storybook-addon-a11y-component-config.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

#### Story-level a11y configuration

Customize the a11y ruleset at the story level by updating your story to include a new parameter:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/storybook-addon-a11y-story-config.js.mdx',
    'react/storybook-addon-a11y-story-config.ts.mdx',
    'angular/storybook-addon-a11y-story-config.ts.mdx',
    'vue/storybook-addon-a11y-story-config.js.mdx',
    'vue/storybook-addon-a11y-story-config.ts.mdx',
    'svelte/storybook-addon-a11y-story-config.js.mdx',
    'svelte/storybook-addon-a11y-story-config.ts.mdx',
    'web-components/storybook-addon-a11y-story-config.js.mdx',
    'web-components/storybook-addon-a11y-story-config.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-tests/accessibility-testing#snippet-storybook-addon-a11y-story-config"
/>

<!-- prettier-ignore-end -->

#### How to disable a11y tests

Disable accessibility testing for stories or components by adding the following parameter to your story’s export or component’s default export respectively:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
   'react/storybook-addon-a11y-disable.js.mdx',
   'react/storybook-addon-a11y-disable.ts.mdx',
   'angular/storybook-addon-a11y-disable.ts.mdx',
   'vue/storybook-addon-a11y-disable.js.mdx',
   'vue/storybook-addon-a11y-disable.ts.mdx',
   'svelte/storybook-addon-a11y-disable.js.mdx',
   'svelte/storybook-addon-a11y-disable.ts.mdx',
   'web-components/storybook-addon-a11y-disable.js.mdx',
   'web-components/storybook-addon-a11y-disable.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-tests/accessibility-testing#snippet-storybook-addon-a11y-disable"
/>

<!-- prettier-ignore-end -->

## Automate accessibility tests with test runner

The most accurate way to check accessibility is manually on real devices. However, you can use automated tools to catch common accessibility issues. For example, [Axe](https://www.deque.com/axe/), on average, catches upwards to [57% of WCAG issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/) automatically.

These tools work by auditing the rendered DOM against heuristics based on [WCAG](https://www.w3.org/WAI/standards-guidelines/wcag/) rules and other industry-accepted best practices. You can then integrate these tools into your test automation pipeline using the Storybook [test runner](./test-runner.md#test-hook-api) and [axe-playwright](https://github.com/abhinaba-ghosh/axe-playwright).

### Setup

To enable accessibility testing with the test runner, you will need to take additional steps to set it up properly. We recommend you go through the [test runner documentation](./test-runner.md) before proceeding with the rest of the required configuration.

Run the following command to install the required dependencies.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/test-runner-axe-playwright.yarn.js.mdx',
    'common/test-runner-axe-playwright.npm.js.mdx',
    'common/test-runner-axe-playwright.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Add a new [configuration file](./test-runner.md#test-hook-api) inside your Storybook directory with the following inside:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/test-runner-a11y-config.js.mdx',
    'common/test-runner-a11y-config.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info" icon="💡">

`preVisit` and `postVisit` are convenient hooks that allow you to extend the test runner's default configuration. Read more about them [here](./test-runner.md#test-hook-api).

</Callout>

When you execute the test runner (for example, with `yarn test-storybook`), it will run the accessibility audit and any [interaction tests](./interaction-testing.md) you might have configured for each component story.

It starts checking for issues by traversing the DOM tree starting from the story's root element and generates a detailed report based on the issues it encountered.

![Accessibility testing with the test runner](./test-runner-a11y-optimized.png)

### A11y config with the test runner

The test runner provides [helper methods](./test-runner.md#helpers), allowing access to the story's information. You can use them to extend the test runner's configuration and provide additional options you may have for a specific story. For example:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/test-runner-a11y-configure.js.mdx',
    'common/test-runner-a11y-configure.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### Disable a11y tests with the test runner

Additionally, if you have already [disabled accessibility](#how-to-disable-a11y-tests) tests for any particular story, you can also configure the test runner to avoid testing it as well. For example:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/test-runner-a11y-disable.js.mdx',
    'common/test-runner-a11y-disable.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

---

#### What’s the difference between browser-based and linter-based accessibility tests?

Browser-based accessibility tests, like those found in Storybook, evaluate the rendered DOM because that gives you the highest accuracy. Auditing code that hasn't been compiled yet is one step removed from the real thing, so you won't catch everything the user might experience.

#### Learn about other UI tests

- [Test runner](./test-runner.md) to automate test execution
- [Visual tests](./visual-testing.md) for appearance
- Accessibility tests for accessibility
- [Interaction tests](./interaction-testing.md) for user behavior simulation
- [Coverage tests](./test-coverage.md) for measuring code coverage
- [Snapshot tests](./snapshot-testing.md) for rendering errors and warnings
- [End-to-end tests](./stories-in-end-to-end-tests.md) for simulating real user scenarios
- [Unit tests](./stories-in-unit-tests.md) for functionality
