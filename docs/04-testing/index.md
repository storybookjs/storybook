---
title: 'How to test UIs with Storybook'
hideRendererSelector: true
---

Storybook provides a clean-room environment for testing components in isolation. Stories make it easy to explore a component in all its variations, no matter how complex.

That means stories are a pragmatic starting point for your UI testing strategy. You already write stories as a natural part of UI development, testing those stories is a low-effort way to prevent UI bugs over time.

<video autoPlay muted playsInline loop>
  <source
    src="stories-are-tests-optimized.mp4"
    type="video/mp4"
  />
</video>

The simplest testing method is manual “spot checking”. You run Storybook locally, then eyeball every story to verify its appearance and behavior. [Publish](../sharing/publish-storybook.md) your Storybook online to share reproductions and get teammates involved.

To test a component in isolation, you often have to mock data, dependencies, or even network requests. Check out our guide on [mocking in Storybook](../writing-stories/build-pages-with-storybook.md#mocking-connected-components) for more info.

Storybook also comes with tools, [a test runner](./test-runner.md), and handy integrations with the larger JavaScript ecosystem to expand your UI test coverage. These docs detail how you can use Storybook for UI testing.

- [**Test runner**](./test-runner.md) to automatically test your entire Storybook and catch broken stories.
- [**Visual tests**](./visual-testing.md) capture a screenshot of every story then compare it against baselines to detect appearance and integration issues
- [**Accessibility tests**](./accessibility-testing.md) catch usability issues related to visual, hearing, mobility, cognitive, speech, or neurological disabilities
- [**Interaction tests**](./interaction-testing.md) verify component functionality by simulating user behaviour, firing events, and ensuring that state is updated as expected
- [**Coverage tests**](./test-coverage.md) to measure how much of your code is covered by your tests
- [**Snapshot tests**](./snapshot-testing.md) detect changes in the rendered markup to surface rendering errors or warnings
- [**End-to-end tests**](./stories-in-end-to-end-tests.md) for simulating real user scenarios
- [**Unit tests**](./stories-in-unit-tests.md) for functionality
