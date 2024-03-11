---
title: 'Feature support for frameworks'
---

Storybook integrates with many popular frontend frameworks. We do our best to keep feature parity amongst frameworks, but it’s tricky for our modest team to support every framework.

Below is a comprehensive table of what’s supported in which framework integration. If you’d like a certain feature supported in your framework, we welcome pull requests.

## Core frameworks

Core frameworks have dedicated maintainers or contributors who are responsible for maintaining the integration. As such, you can use most Storybook features in these frameworks.

|                                                                                           | React | Vue | Angular | Web Components |
| ----------------------------------------------------------------------------------------- | ----- | --- | ------- | -------------- |
| **Essentials**                                                                            |       |     |         |                |
| [Actions](../essentials/actions.md)                                                       | ✅    | ✅  | ✅      | ✅             |
| [Backgrounds](../essentials/backgrounds.md)                                               | ✅    | ✅  | ✅      | ✅             |
| [Docs](../writing-docs/index.md)                                                          | ✅    | ✅  | ✅      | ✅             |
| [Viewport](../essentials/viewport.md)                                                     | ✅    | ✅  | ✅      | ✅             |
| [Controls](../essentials/controls.md)                                                     | ✅    | ✅  | ✅      | ✅             |
| [Measure](../essentials/measure-and-outline.md#measure-addon)                             | ✅    | ✅  | ✅      | ✅             |
| [Outline](../essentials/measure-and-outline.md#outline-addon)                             | ✅    | ✅  | ✅      | ✅             |
| **Addons**                                                                                |       |     |         |                |
| [A11y](../writing-tests/accessibility-testing.md)                                         | ✅    | ✅  | ✅      | ✅             |
| [Interactions](../writing-tests/interaction-testing.md)                                   | ✅    | ✅  | ✅      | ✅             |
| [Test runner](../writing-tests/test-runner.md)                                            | ✅    | ✅  | ✅      | ✅             |
| [Test coverage](../writing-tests/test-coverage.md)                                        | ✅    | ✅  | ✅      | ✅             |
| [CSS resources](https://github.com/storybookjs/addon-cssresources)                        | ✅    | ✅  | ✅      | ✅             |
| [Design assets](https://github.com/storybookjs/addon-design-assets)                       | ✅    | ✅  | ✅      | ✅             |
| [Events](https://github.com/storybookjs/addon-events)                                     | ✅    | ✅  | ✅      | ✅             |
| [Google analytics](https://github.com/storybookjs/addon-google-analytics)                 | ✅    | ✅  | ✅      | ✅             |
| [GraphQL](https://github.com/storybookjs/addon-graphql)                                   | ✅    |     | ✅      |                |
| [Jest](https://github.com/storybookjs/storybook/tree/next/code/addons/jest)               | ✅    | ✅  | ✅      | ✅             |
| [Links](https://github.com/storybookjs/storybook/tree/next/code/addons/links)             | ✅    | ✅  | ✅      | ✅             |
| [Queryparams](https://github.com/storybookjs/addon-queryparams)                           | ✅    | ✅  | ✅      | ✅             |
| [Storysource](https://github.com/storybookjs/storybook/tree/next/code/addons/storysource) | ✅    | ✅  | ✅      | ✅             |
| **Docs**                                                                                  |       |     |         |                |
| [CSF Stories](../api/csf.md)                                                              | ✅    | ✅  | ✅      | ✅             |
| [Autodocs](../writing-docs/autodocs.md)                                                   | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - ArgTypes](../api/doc-block-argtypes.md)                                     | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Canvas](../api/doc-block-canvas.md)                                         | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - ColorPalette](../api/doc-block-colorpalette.md)                             | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Controls](../api/doc-block-controls.md)                                     | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Description](../api/doc-block-description.md)                               | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - IconGallery](../api/doc-block-icongallery.md)                               | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Markdown](../api/doc-block-markdown.md)                                     | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Meta](../api/doc-block-meta.md)                                             | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Primary](../api/doc-block-primary.md)                                       | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Source](../api/doc-block-source.md)                                         | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Story](../api/doc-block-story.md)                                           | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Stories](../api/doc-block-stories.md)                                       | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Subtitle](../api/doc-block-subtitle.md)                                     | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Title](../api/doc-block-title.md)                                           | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Typeset](../api/doc-block-typeset.md)                                       | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - Unstyled](../api/doc-block-unstyled.md)                                     | ✅    | ✅  | ✅      | ✅             |
| [Doc Blocks - UseOf](../api/doc-block-useof.md)                                           | ✅    | ✅  | ✅      | ✅             |
| Inline stories                                                                            | ✅    | ✅  | ✅      | ✅             |

## Community frameworks

Community frameworks have fewer contributors which means they may not be as up to date as core frameworks. If you use one of these frameworks for your job, please consider contributing to its integration with Storybook.

|                                                                                           | Ember | HTML | Svelte | Preact | Qwik | SolidJS |
| ----------------------------------------------------------------------------------------- | ----- | ---- | ------ | ------ | ---- | ------- |
| **Essentials**                                                                            |       |      |        |        |      |         |
| [Actions](../essentials/actions.md)                                                       | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Backgrounds](../essentials/backgrounds.md)                                               | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Docs](../writing-docs/index.md)                                                          | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Viewport](../essentials/viewport.md)                                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Controls](../essentials/controls.md)                                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Measure](../essentials/measure-and-outline.md#measure-addon)                             | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Outline](../essentials/measure-and-outline.md#outline-addon)                             | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| **Addons**                                                                                |       |      |        |        |      |         |
| [A11y](../writing-tests/accessibility-testing.md)                                         | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Interactions](../writing-tests/interaction-testing.md)                                   |       | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Test runner](../writing-tests/test-runner.md)                                            |       | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Test coverage](../writing-tests/test-coverage.md)                                        |       | ✅   | ✅     | ✅     | ✅   | ✅      |
| [CSS resources](https://github.com/storybookjs/addon-cssresources)                        | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Design assets](https://github.com/storybookjs/addon-design-assets)                       | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Events](https://github.com/storybookjs/addon-events)                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Google analytics](https://github.com/storybookjs/addon-google-analytics)                 | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [GraphQL](https://github.com/storybookjs/addon-graphql)                                   |       |      |        |        |      |         |
| [Jest](https://github.com/storybookjs/storybook/tree/next/code/addons/jest)               | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Links](https://github.com/storybookjs/storybook/tree/next/code/addons/links)             | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Queryparams](https://github.com/storybookjs/addon-queryparams)                           | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Storysource](https://github.com/storybookjs/storybook/tree/next/code/addons/storysource) | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| **Docs**                                                                                  |       |      |        |        |      |         |
| [CSF Stories](../api/csf.md)                                                              | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Autodocs](../writing-docs/autodocs.md)                                                   |       | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - ArgTypes](../api/doc-block-argtypes.md)                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Canvas](../api/doc-block-canvas.md)                                         | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - ColorPalette](../api/doc-block-colorpalette.md)                             | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Controls](../api/doc-block-controls.md)                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Description](../api/doc-block-description.md)                               | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - IconGallery](../api/doc-block-icongallery.md)                               | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Markdown](../api/doc-block-markdown.md)                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Meta](../api/doc-block-meta.md)                                             | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Primary](../api/doc-block-primary.md)                                       | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Source](../api/doc-block-source.md)                                         | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Story](../api/doc-block-story.md)                                           | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Stories](../api/doc-block-stories.md)                                       | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Subtitle](../api/doc-block-subtitle.md)                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Title](../api/doc-block-title.md)                                           | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Typeset](../api/doc-block-typeset.md)                                       | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - Unstyled](../api/doc-block-unstyled.md)                                     | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| [Doc Blocks - UseOf](../api/doc-block-useof.md)                                           | ✅    | ✅   | ✅     | ✅     | ✅   | ✅      |
| Inline stories                                                                            |       | ✅   | ✅     |        |      |         |

## Deprecated

To align the Storybook ecosystem with the current state of frontend development, the following features and addons are now deprecated, no longer maintained, and will be removed in future versions of Storybook

| Feature                                                                                                  | Status                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Knobs](https://github.com/storybookjs/addon-knobs)                                                      | The Knobs addon was officially deprecated with the release of Storybook 6.3 and is no longer actively maintained. We recommend using the [controls](../essentials/controls.md) instead.                                                                                                                                                                          |
| [Storyshots](../writing-tests/snapshot-testing.md)                                                       | The Storyshots addon was officially deprecated with the release of Storybook 7.6 and is no longer actively maintained. See the [migration guide](../writing-tests/storyshots-migration-guide.md) for the available alternatives.                                                                                                                                 |
| [`StoriesOf`](https://github.com/storybookjs/storybook/blob/next/code/lib/preview-api/docs/storiesOf.md) | The `storiesOf` API was officially deprecated with the release of Storybook 7.5 and is no longer actively maintained. We recommend using the [CSF API](../api/csf.md) instead for writing stories.<br/>See the [migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storystorev6-and-storiesof-is-deprecated) for more information. |
