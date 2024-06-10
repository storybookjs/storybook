<h1>Storybook Docs for Web Components</h1>

- [Installation](#installation)
- [Props tables](#props-tables)
- [Stories not inline](#stories-not-inline)
- [More resources](#more-resources)

## Installation

- Be sure to check the [installation section of the general addon-docs page](../README.md) before proceeding.
- Be sure to have a [custom-elements.json](./#custom-elementsjson) file.
- Add to your `.storybook/preview.js`

  ```js
  import { setCustomElementsManifest } from '@storybook/web-components';
  import customElements from '../custom-elements.json';

  setCustomElementsManifest(customElements);
  ```

- Add to your story files

  ```js
  export default {
    title: 'Demo Card',
    component: 'your-component-name', // which is also found in the `custom-elements.json`
  };
  ```

## Props tables

In order to get [Props tables](..docs/../../docs/props-tables.md) documentation for web-components you will need to have a [custom-elements.json](https://github.com/webcomponents/custom-elements-json) file.

You can hand write it or better generate it. Depending on the web components sugar you are choosing your mileage may vary.

Known analyzers that output `custom-elements.json` v1.0.0:

- [@custom-elements-manifest/analyzer](https://github.com/open-wc/custom-elements-manifest)
  - Supports Vanilla, LitElement, FASTElement, Stencil, Catalyst, Atomico

Known analyzers that output older versions of `custom-elements.json`:

- [web-component-analyzer](https://github.com/runem/web-component-analyzer)
  - Supports LitElement, Polymer, Vanilla, (Stencil)
- [stenciljs](https://stenciljs.com/)
  - Supports Stencil (but does not have all metadata)

To generate this file with Stencil, add `docs-vscode` to outputTargets in `stencil.config.ts`:

```
{
  type: 'docs-vscode',
  file: 'custom-elements.json'
},
```

The file looks something like this:

```json
{
  "schemaVersion": "1.0.0",
  "readme": "",
  "modules": [
    {
      "kind": "javascript-module",
      "path": "src/my-element.js",
      "declarations": [
        {
          "kind": "class",
          "description": "",
          "name": "MyElement",
          "members": [
            {
              "kind": "field",
              "name": "disabled"
            },
            {
              "kind": "method",
              "name": "fire"
            }
          ],
          "events": [
            {
              "name": "disabled-changed",
              "type": {
                "text": "Event"
              }
            }
          ],
          "superclass": {
            "name": "HTMLElement"
          },
          "tagName": "my-element"
        }
      ],
      "exports": [
        {
          "kind": "custom-element-definition",
          "name": "my-element",
          "declaration": {
            "name": "MyElement",
            "module": "src/my-element.js"
          }
        }
      ]
    }
  ]
}
```

For a full example see the [web-components-kitchen-sink/custom-elements.json](../../../examples/web-components-kitchen-sink/custom-elements.json).

## Stories not inline

Storybook Docs renders all web components stories inline by default.

However, you can render stories in an iframe, with a default height of `60px` (configurable using the `docs.story.iframeHeight` story parameter), by using the `docs.stories.inline` parameter.

To do so for all stories, update `.storybook/preview.js`:

```js
export const parameters = { docs: { story: { inline: false } } };
```

## More resources

Want to learn more? Here are some more articles on Storybook Docs:

- References: [DocsPage](../docs/docspage.md) / [MDX](../docs/mdx.md) / [FAQ](../docs/faq.md) / [Recipes](../docs/recipes.md) / [Theming](../docs/theming.md) / [Props](../docs/props-tables.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
