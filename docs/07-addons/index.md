---
title: 'Introduction to addons'
hideRendererSelector: true
---

Addons extend Storybook with features and integrations that are not built into the core. Most Storybook features are implemented as addons. For instance: [documentation](../writing-docs/index.md), [accessibility testing](https://github.com/storybookjs/storybook/tree/master/addons/a11y), [interactive controls](../essentials/controls.md), among others.
The [addon API](./addons-api.md) makes it easy for you to configure and customize Storybook in new ways. There are countless addons made by the community that unlocks time-saving workflows.

Browse our [addon catalog](https://storybook.js.org/addons) to install an existing addon or as inspiration for your own addon.

## Storybook basics

Before writing your first [addon](https://storybook.js.org/addons), let’s take a look at the basics of Storybook’s architecture. While Storybook presents a unified user interface, under the hood it’s divided down the middle into **Manager** and **Preview**.

The **Manager** is the UI responsible for rendering the:

- 🔍 Search
- 🧭 Navigation
- 🔗 Toolbars
- 📦 Addons

The **Preview** area is an `iframe` where your stories are rendered.

![Storybook detailed window](./manager-preview.png)

Because both elements run in their own separate `iframes`, they use a communication channel to keep in sync. For example, when you select a story in the Manager an event is dispatched across the channel notifying the Preview to render the story.

## Anatomy of an addon

Storybook addons allow you to extend what's already possible with Storybook, everything from the [user interface](./addon-types.md) to the [API](./addons-api.md). Each one is classified into two broader categories.

### UI-based addons

[UI-based addons](./addon-types.md#ui-based-addons) focus on customizing Storybook's user interface to extend your development workflow. Examples of UI-based addons include: [Controls](../essentials/controls.md), [Docs](../writing-docs/index.md) and [Accessibility](https://github.com/storybookjs/storybook/tree/master/addons/a11y).

[Learn how to write an addon »](./writing-addons.md)

### Preset addons

[Preset addons](./addon-types.md#preset-addons) help you integrate Storybook with other technologies and libraries. An examples of a preset addons is [preset-create-react-app](https://github.com/storybookjs/presets/tree/master/packages/preset-create-react-app).

[Learn how to write a preset addon »](./writing-presets.md)
