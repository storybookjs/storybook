<h1>Storybook manager's UI</h1>

Storybook manager is the core UI of [Storybook](https://storybook.js.org).
It's a React based UI which you can initialize with a function.
You can configure it by providing a provider API.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Usage](#usage)
- [API](#api)
  - [.setOptions()](#setoptions)
- [.setStories()](#setstories)
- [.onStory()](#onstory)
- [Hacking Guide](#hacking-guide)
  - [The App](#the-app)
  - [Changing UI](#changing-ui)
  - [Mounting](#mounting)
  - [App Context](#app-context)
  - [Actions](#actions)
  - [Core API](#core-api)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [URL Changes](#url-changes)
  - [Story Order](#story-order)

## Usage

First you need to install `@storybook/manager` into your app.

```sh
yarn add @storybook/manager --dev
```

Then you need to create a Provider class like this:

```js
import React from 'react';
import { Provider } from '@storybook/manager';

export default class MyProvider extends Provider {
  getElements(type) {
    return {};
  }

  renderPreview() {
    return <p>This is the Preview</p>;
  }

  handleAPI(api) {
    // no need to do anything for now.
  }
}
```

Then you need to initialize the UI like this:

```js
import { renderStorybookUI } from '@storybook/manager';
import global from 'global';
import Provider from './provider';

const { document } = global;

const roolEl = document.getElementById('root');
renderStorybookUI(roolEl, new Provider());
```

## API

### .setOptions()

```js
import { Provider } from '@storybook/manager';

class ReactProvider extends Provider {
  handleAPI(api) {
    api.setOptions({
      // see available options in
      // https://storybook.js.org/docs/react/configure/features-and-behavior
    });
  }
}
```

## .setStories()

This API is used to pass the`kind` and `stories` list to storybook-ui.

```js
import { Provider } from '@storybook/manager';

class ReactProvider extends Provider {
  handleAPI(api) {
    api.setStories([
      {
        kind: 'Component 1',
        stories: ['State 1', 'State 2'],
      },

      {
        kind: 'Component 2',
        stories: ['State a', 'State b'],
      },
    ]);
  }
}
```

## .onStory()

You can use to listen to the story change and update the preview.

```js
import { Provider } from '@storybook/manager';

class ReactProvider extends Provider {
  handleAPI(api) {
    api.onStory((kind, story) => {
      this.globalState.emit('change', kind, story);
    });
  }
}
```

## Hacking Guide

If you like to add features to the Storybook UI or fix bugs, this is the guide you need to follow.

First of all, familiarize yourself with code used. Check the [source](./src/) folder for the source code.

### The App

This is a Redux app written based on the [Mantra architecture](https://github.com/kadirahq/mantra/).
It's a set of modules. You can see those modules at `src/modules` directory.

### Changing UI

If you like to change the appearance of the UI, you need to look at the `ui` module. Change components at the `components` directory for UI tweaks.

You can also change containers(which are written with [react-komposer](https://github.com/kadirahq/react-komposer/)) to add more data from the redux state.

### Mounting

The UI is mounted in the `src/modules/ui/routes.js`. Inside that, we have injected dependencies as well. Refer [mantra-core](https://github.com/mantrajs/mantra-core) for that.

We've injected the context and actions.

### App Context

App context is the app which application context you initialize when creating the UI. It is initialized in the `src/index.js` file. It's a non serializable state. You can access the app context from containers and basically most of the place in the app.

So, that's the place to put app wide configurations and objects which won't changed after initialized. Our redux store is also stayed inside the app context.

### Actions

Actions are the place we implement app logic in a Mantra app. Each module has a set of actions and they are globally accessible. These actions are located at `<module>/actions` directory.

They got injected into the app(when mounting) and you can access them via containers. If you are familiar with redux, this is exactly action creators. But they are not only limited to do redux stuff. Actions has the access to the app context, so literally it can do anything.

### Core API

Core API (which is passed to the Provider with `handleAPI` method) is implemented in the `api` module. We put the provider passed by the user in the app context. Then api module access it and use it as needed.

### Keyboard Shortcuts

Keyboard shortcuts are implemented in a bit different way. The final state of keyboard shortcuts is managed by the `shortcuts` module. But they are implemented in the `ui` module with `src/modules/ui/configs/handle_routing.js`

These shortcuts also can be called from main API using the `handleShortcut` method. Check the example app for the usage. That's implemented as an action in the `shortcuts` module.

The above action(or the `handleShortcut` method) accepts events as a constant defined by this module. They are defined in the `src/libs/key_events.js`. This is basically to serialize these events.

> In react-storybook we need to pass these events from the preview iframe to the main app. That's the core reason for this.

### URL Changes

TODO: state we use reach/router customized to query params

### Story Order

Stories are sorted in the order in which they were imported. This can be overridden by adding storySort to the Parameters for the stories in `.storybook/preview.js`:

```js
addParameters({
  options: {
    storySort: (a, b) => a[1].id.localeCompare(b[1].id),
  },
});
```
