# Storybook for Server

---

Storybook for Server is a UI development environment for your plain HTML snippets rendered by your server backend.
With it, you can visualize different states of your UI components and develop them interactively.

![Storybook Screenshot](https://github.com/storybookjs/storybook/blob/main/media/storybook-intro.gif)

Storybook runs outside of your app.
So you can develop UI components in isolation without worrying about app specific dependencies and requirements.

## Getting Started

```sh
cd my-app
npx storybook@latest init -t server
```

To configure the server that Storybook will connect to, export a global parameter `parameters.server.url` in `.storybook/preview.js`:

```js
export const parameters = {
  server: {
    url: `http://localhost:${port}/storybook_preview`,
  },
};
```

The URL you connect to should have the ability to render a story, see [server rendering](#server-rendering) below.

For more information visit: [storybook.js.org](https://storybook.js.org)

## Writing Stories

To write a story, use whatever API is natural for your server-side rendering framework to generate set of JSON or YAML files of stories analogous to CSF files (see the [`server-kitchen-sink`](../../../test-storybooks/server-kitchen-sink/stories) example for ideas).

```json
{
  "title": "Component",
  "parameters": {
    "options": { "component": "my_widget" }
  },
  "stories": [
    {
      "name": "Default",
      "parameters": {
        "server": { "id": "path/of/your/story" }
      }
    }
  ]
}
```

In your `.storybook/main.js` you simply provide a glob specifying the location of those JSON files, e.g.

```js
export default {
  stories: ['../stories/**/*.stories.json'],
};
```

Notice that the JSON does not specify a rendering function -- `@storybook/server` will instead call your `parameters.server.url` with the story's server id appended.

For example the JSON story above is requivalent to the CSF3 definition:

```javascript
export default {
  title: 'Component',
  parameters: {
    options: {
      component: 'my_widget',
    },
  },
};

export const Default = {
  name: 'Default',
  parameters: {
    server: {
      id: 'path/of/your/story"',
    },
  },
};
```

With the story HTML will be fetched from the server by making a GET request to http://localhost/storybook_preview/path/of/your/story`

### Ruby/Rails support

In particular the [View Component::Storybook](https://github.com/jonspalmer/view_component_storybook) gem provides a Ruby API for easily creating the above with a Ruby/Rails DSL (as well as providing a server rendering endpoint).

## Server rendering

The server rendering side of things is relatively straightforward. When you browse to a story in the sidebar, Storybook will make a `fetch` request to `${parameters.server.url}/{parameters.server.id}` and display the HTML that is returned.

You need to ensure the route in your server app renders the appropriate HTML when called in that fashion.

### Passing parameters to the server

Many components are likely to be dynamic - responding to parameters that change their content or appearance. `@storybook\server` has two mechanisms for passing those parameters to the server - `params` and `args`. Parameters defined in this way are appended to the fetch url as query string parameters. The server endpoint is responsible for interpreting those parameters and vary the returned html appropriately

#### Constant parameters with `params`

Static parameters can be defined using the `params` story parameter. For example suppose you have a Button component that has a label and color options:

```json
{
  "title": "Buttons",
  "stories": [
    {
      "name": "Red",
      "parameters": {
        "server": {
          "id": "button",
          "params": { "color": "red", "label": "Stop" }
        }
      }
    },
    {
      "name": "Green",
      "parameters": {
        "server": {
          "id": "button",
          "params": { "color": "green", "label": "OK" }
        }
      }
    }
  ]
}
```

The Red and Green story HTML will be fetched from the urls `server.url/controls/button?color=red&label=Stop` and `server.url/controls/button?color=green&label=OK`

Like all story parameters server params can be defined in the default export and overridden in stories.

```json
{
  "title": "Buttons",
  "parameters": {
    "server": {
      "params": { "color": "red" }
    }
  },
  "stories": [
    {
      "name": "Default",
      "parameters": {
        "server": {
          "id": "button",
          "params": { "label": "Stop" }
        }
      }
    },
    {
      "name": "Green",
      "parameters": {
        "server": {
          "id": "button",
          "params": { "color": "green", "label": "OK" }
        }
      }
    }
  ]
}
```

#### Dynamic parameters with `args` and Controls

Dynamic parameters can be defined using args and the Controls addon

```json
{
  "title": "Buttons",
  "stories": [
    {
      "name": "Red",
      "parameters": {
        "server": {
          "id": "button"
        }
      },
      "args": { "color": "red", "label": "Stop" }
    },
    {
      "name": "Green",
      "parameters": {
        "server": {
          "id": "button"
        }
      },
      "args": { "color": "green", "label": "Go" }
    }
  ]
}
```

Story args are passed to the server as url query parameters just like `params` except now they can be varied on the Controls addon panel.

Just like CSF stories we can define `argTypes` to specify the controls used in the controls panel. `argTypes` can be defined at the default or story level.

```json
{
  "title": "Buttons",
  "argTypes": {
    "color": { "control": { "type": "color" } }
  },
  "stories": [
    {
      "name": "Red",
      "parameters": {
        "server": {
          "id": "button"
        }
      },
      "args": { "color": "red", "label": "Stop" }
    },
    {
      "name": "Green",
      "parameters": {
        "server": {
          "id": "button"
        }
      },
      "args": { "color": "green", "label": "Go" }
    }
  ]
}
```

## Addon compatibility

Storybook also comes with a lot of [addons](https://storybook.js.org/addons) and a great API to customize as you wish. As some addons assume the story is rendered in JS, they may not work with `@storybook/server` (yet!).

Many addons that act on the manager side (such as `backgrounds` and `viewport`) will work out of the box with `@storybook/server` -- you can configure them with parameters written on the server as usual.

### Controls

To configure controls, simple add `args` and `argTypes` keys to the story JSON much like you would CSF:

```json
{
  "title": "Controls",
  "stories": [
    {
      "name": "Button",
      "parameters": {
        "server": { "id": "controls/button" }
      },
      "args": { "button_text": "Push Me", "color": "red" },
      "argTypes": { "button_text": { "control": { "type": "color" } } }
    }
  ]
}
```

The controls values will be added to your story URL as query parameters.

### Actions

To use actions, use the `parameters.actions.handles` parameter:

```json
{
  "title": "Actions",
  "stories": [
    {
      "name": "Button",
      "parameters": {
        "server": { "id": "actions/button" },
        "actions": {
          "handles": ["mouseover", "click .btn"]
        }
      }
    }
  ]
}
```

## Advanced Configuration

### fetchStoryHtml

For control over how `@storybook/server` fetches Html from the server you can provide a `fetchStoryHtml` function as a parameter. You would typically set this in `.storybook/preview.js` but it's just a regular Storybook parameter so could be overridden at the stories or story level.

```javascript
// .storybook/preview.js

const fetchStoryHtml = async (url, path, params, context) => {
  // Custom fetch implementation
  // ....
  return html;
};

export const parameters = {
  server: {
    url: `http://localhost:${port}/storybook_preview`,
    fetchStoryHtml,
  },
};
```

`fetchStoryHtml` should be an async function with the following signature

```javascript
type FetchStoryHtmlType = (
  url: string,
  id: string,
  params: any,
  context: StoryContext
) => Promise<string | Node>;
```

- url: Server url configured by the `parameters.server.url`
- id: Id of the story being rendered given by `parameters.server.id`
- params: Merged story params `parameters.server.params`and story args
- context: The context of the story
