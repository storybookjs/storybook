---
title: 'Interaction tests'
---

As you build more complex UIs like pages, components become responsible for more than just rendering the UI. They fetch data and manage state. Interaction tests allow you to verify these functional aspects of UIs.

In a nutshell, you start by supplying the appropriate props for the initial state of a component. Then simulate user behavior such as clicks and form entries. Finally, check whether the UI and component state update correctly.

In Storybook, this familiar workflow happens in your browser. That makes it easier to debug failures because you're running tests in the same environment as you develop components: the browser.

<video autoPlay muted playsInline loop>
  <source
    src="component-interaction-testing.mp4"
    type="video/mp4"
  />
</video>

## How does component testing in Storybook work?

You start by writing a [**story**](../writing-stories/index.md) to set up the component's initial state. Then simulate user behavior using the **play** function. Finally, use the **test-runner** to confirm that the component renders correctly and that your interaction tests with the **play** function pass. Additionally, you can automate test execution via the [command line](./test-runner.md#cli-options) or in your [CI environment](./test-runner.md#set-up-ci-to-run-tests).

- The [`play`](../writing-stories/play-function.md) function is a small snippet of code that runs after a story finishes rendering. You can use this to test user workflows.
- The test is written using Storybook-instrumented versions of [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/) coming from the [`@storybook/test`](https://npmjs.com/package/@storybook/test) package.
- [`@storybook/addon-interactions`](https://storybook.js.org/addons/@storybook/addon-interactions/) visualizes the test in Storybook and provides a playback interface for convenient browser-based debugging.
- [`@storybook/test-runner`](https://github.com/storybookjs/test-runner) is a standalone utility—powered by [Jest](https://jestjs.io/) and [Playwright](https://playwright.dev/)—that executes all of your interactions tests and catches broken stories.

## Set up the interactions addon

To enable interaction testing with Storybook, you'll need to take additional steps to set it up properly. We recommend you go through the [test runner documentation](./test-runner.md) before proceeding with the rest of the required configuration.

Run the following command to install the interactions addon and related dependencies.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-addon-interactions-addon-full-install.yarn.js.mdx',
    'common/storybook-addon-interactions-addon-full-install.npm.js.mdx',
    'common/storybook-addon-interactions-addon-full-install.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Update your Storybook configuration (in `.storybook/main.js|ts`) to include the interactions addon.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-interactions-addon-registration.js.mdx',
    'common/storybook-interactions-addon-registration.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## Write an interaction test

The test itself is defined inside a `play` function connected to a story. Here's an example of how to set up an interaction test with Storybook and the `play` function:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/login-form-with-play-function.js.mdx',
    'react/login-form-with-play-function.ts.mdx',
    'angular/login-form-with-play-function.ts.mdx',
    'vue/login-form-with-play-function.js.mdx',
    'vue/login-form-with-play-function.ts.mdx',
    'web-components/login-form-with-play-function.js.mdx',
    'web-components/login-form-with-play-function.ts.mdx',
    'svelte/login-form-with-play-function.js.mdx',
    'svelte/login-form-with-play-function.ts.mdx',
    'solid/login-form-with-play-function.js.mdx',
    'solid/login-form-with-play-function.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-tests/interaction-testing#snippet-login-form-with-play-function"
/>

<!-- prettier-ignore-end -->

Once the story loads in the UI, it simulates the user's behavior and verifies the underlying logic.

<video autoPlay muted playsInline loop>
  <source
    src="addon-interaction-example-optimized.mp4"
    type="video/mp4"
  />
</video>

### Run code before each test

It can be helpful to run code before each test to set up the initial state of the component or reset the state of modules. You can do this by adding an asynchronous `beforeEach` function to the story, meta (which will run before each story in the file), or the preview file (`.storybook/preview.js|ts`, which will run before every story in the project).

Additionally, if you return a cleanup function from the `beforeEach` function, it will run **after** each test, when the story is remounted or navigated away from.

<Callout variant="info">

It is _not_ necessary to restore `fn()` mocks with the cleanup function, as Storybook will already do that automatically before rendering a story. See the [`parameters.test.restoreMocks` API](../api/parameters.md#restoremocks) for more information.

</Callout>

Here's an example of using the [`mockdate`](https://github.com/boblauer/MockDate) package to mock the [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) and reset it when the story unmounts.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'angular/before-each-in-meta-mock-date.ts.mdx',
    'web-components/before-each-in-meta-mock-date.js.mdx',
    'web-components/before-each-in-meta-mock-date.ts.mdx',
    'common/before-each-in-meta-mock-date.js.mdx',
    'common/before-each-in-meta-mock-date.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### API for user-events

Under the hood, Storybook’s `@storybook/test` package provides Testing Library’s [`user-events`](https://testing-library.com/docs/user-event/intro/) APIs. If you’re familiar with [Testing Library](https://testing-library.com/), you should be at home in Storybook.

Below is an abridged API for user-event. For more, check out the [official user-event docs](https://testing-library.com/docs/user-event/utility/).

| User events       | Description                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clear`           | Selects the text inside inputs, or textareas and deletes it <br/>`userEvent.clear(await within(canvasElement).getByRole('myinput'));`                    |
| `click`           | Clicks the element, calling a click() function <br/>`userEvent.click(await within(canvasElement).getByText('mycheckbox'));`                              |
| `dblClick`        | Clicks the element twice <br/>`userEvent.dblClick(await within(canvasElement).getByText('mycheckbox'));`                                                 |
| `deselectOptions` | Removes the selection from a specific option of a select element <br/>`userEvent.deselectOptions(await within(canvasElement).getByRole('listbox'),'1');` |
| `hover`           | Hovers an element <br/>`userEvent.hover(await within(canvasElement).getByTestId('example-test'));`                                                       |
| `keyboard`        | Simulates the keyboard events <br/>`userEvent.keyboard(‘foo’);`                                                                                          |
| `selectOptions`   | Selects the specified option, or options of a select element <br/>`userEvent.selectOptions(await within(canvasElement).getByRole('listbox'),['1','2']);` |
| `type`            | Writes text inside inputs, or textareas <br/>`userEvent.type(await within(canvasElement).getByRole('my-input'),'Some text');`                            |
| `unhover`         | Unhovers out of element <br/>`userEvent.unhover(await within(canvasElement).getByLabelText(/Example/i));`                                                |

### Assert tests with Vitest's APIs

Storybook’s `@storybook/test` also provides APIs from [Vitest](https://vitest.dev/), such as [`expect`](https://vitest.dev/api/expect.html#expect) and [`vi.fn`](https://vitest.dev/api/vi.html#vi-fn). These APIs improve your testing experience, helping you assert whether a function has been called, if an element exists in the DOM, and much more. If you are used to `expect` from testing packages such as [Jest](https://jestjs.io/) or [Vitest](https://vitest.dev/), you can write interaction tests in much the same way.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'angular/storybook-interactions-play-function.ts.mdx',
    'web-components/storybook-interactions-play-function.js.mdx',
    'web-components/storybook-interactions-play-function.ts.mdx',
    'common/storybook-interactions-play-function.js.mdx',
    'common/storybook-interactions-play-function.ts.mdx',
  ]}
  usesCsf3
  csf2Path="essentials/interactions#snippet-storybook-interactions-play-function"
/>

<!-- prettier-ignore-end -->

### Group interactions with the `step` function

For complex flows, it can be worthwhile to group sets of related interactions together using the `step` function. This allows you to provide a custom label that describes a set of interactions:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'angular/storybook-interactions-step-function.ts.mdx',
    'web-components/storybook-interactions-step-function.js.mdx',
    'web-components/storybook-interactions-step-function.ts.mdx',
    'common/storybook-interactions-step-function.js.mdx',
    'common/storybook-interactions-step-function.ts.mdx',
  ]}
  usesCsf3
  csf2Path="writing-tests/interaction-testing#snippet-storybook-interactions-step-function"
/>

<!-- prettier-ignore-end -->

This will show your interactions nested in a collapsible group:

![Interaction testing with labeled steps](./storybook-addon-interactions-steps.png)

### Mocked modules

If your component depends on modules that are imported into the component file, you can mock those modules to control and assert on their behavior. This is detailed in the [mocking modules](./mocking-modules.md) guide.

You can then import the mocked module (which has all of the helpful methods of a [Vitest mocked function](https://vitest.dev/api/mock.html)) into your story and use it to assert on the behavior of your component:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'angular/storybook-test-fn-mock-spy.ts.mdx',
    'web-components/storybook-test-fn-mock-spy.js.mdx',
    'web-components/storybook-test-fn-mock-spy.ts.mdx',
    'common/storybook-test-fn-mock-spy.js.mdx',
    'common/storybook-test-fn-mock-spy.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### Interactive debugger

If you check your interactions panel, you'll see the step-by-step flow. It also offers a handy set of UI controls to pause, resume, rewind, and step through each interaction.

<video autoPlay muted playsInline loop>
  <source
    src="addon-interactions-playback-controls-optimized.mp4"
    type="video/mp4"
  />
</video>

### Permalinks for reproductions

The `play` function is executed after the story is rendered. If there’s an error, it’ll be shown in the interaction addon panel to help with debugging.

Since Storybook is a webapp, anyone with the URL can reproduce the error with the same detailed information without any additional environment configuration or tooling required.

![Interaction testing with a component](./storybook-addon-interactions-error-optimized.png)

Streamline interaction testing further by automatically [publishing Storybook](../sharing/publish-storybook.md) in pull requests. That gives teams a universal reference point to test and debug stories.

## Execute tests with the test-runner

Storybook only runs the interaction test when you're viewing a story. Therefore, you'd have to go through each story to run all your checks. As your Storybook grows, it becomes unrealistic to review each change manually. Storybook [test-runner](https://github.com/storybookjs/test-runner) automates the process by running all tests for you. To execute the test-runner, open a new terminal window and run the following command:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/test-runner-execute.yarn.js.mdx',
    'common/test-runner-execute.npm.js.mdx',
    'common/test-runner-execute.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

![Interaction test with test runner](./storybook-interaction-test-runner-loginform-optimized.png)

<Callout variant="info" icon="💡">

If you need, you can provide additional flags to the test-runner. Read the [documentation](./test-runner.md#cli-options) to learn more.

</Callout>

## Automate

Once you're ready to push your code into a pull request, you'll want to automatically run all your checks using a Continuous Integration (CI) service before merging it. Read our [documentation](./test-runner.md#set-up-ci-to-run-tests) for a detailed guide on setting up a CI environment to run tests.

## Troubleshooting

### The TypeScript types aren't recognized

If you're writing interaction tests with TypeScript, you may run into a situation where the TypeScript types aren't recognized in your IDE. This a known issue with newer package managers (e.g., pnpm, Yarn) and how they hoist dependencies. If you're working with Yarn the process happens automatically and the types should be recognized. However, if you're working with pnpm, you'll need to create a `.npmrc` file in the root of your project and add the following:

```text
// .npmrc
public-hoist-pattern[]=@types*
```

If you're still encountering issues, you can always add the [`@types/testing-library__jest-dom`](https://www.npmjs.com/package/@types/testing-library__jest-dom) package to your project.

---

#### What’s the difference between interaction tests and visual tests?

Interaction tests can be expensive to maintain when applied wholesale to every component. We recommend combining them with other methods like visual testing for comprehensive coverage with less maintenance work.

#### What's the difference between interaction tests and using Jest + Testing Library alone?

Interaction tests integrate Jest and Testing Library into Storybook. The biggest benefit is the ability to view the component you're testing in a real browser. That helps you debug visually, instead of getting a dump of the (fake) DOM in the command line or hitting the limitations of how JSDOM mocks browser functionality. It's also more convenient to keep stories and tests together in one file than having them spread across files.

**Learn about other UI tests**

- [Test runner](./test-runner.md) to automate test execution
- [Visual tests](./visual-testing.md) for appearance
- [Accessibility tests](./accessibility-testing.md) for accessibility
- Interaction tests for user behavior simulation
- [Coverage tests](./test-coverage.md) for measuring code coverage
- [Snapshot tests](./snapshot-testing.md) for rendering errors and warnings
- [End-to-end tests](./stories-in-end-to-end-tests.md) for simulating real user scenarios
- [Unit tests](./stories-in-unit-tests.md) for functionality
