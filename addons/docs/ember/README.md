<h1>Storybook Docs for Ember</h1>

> migration guide: This page documents the method to configure storybook introduced recently in 5.3.0, consult the [migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) if you want to migrate to this format of configuring storybook.

Storybook Docs transforms your Storybook stories into world-class component documentation. Storybook Docs for Ember supports [DocsPage](../docs/docspage.md) for auto-generated docs, and [MDX](../docs/mdx.md) for rich long-form docs.

To learn more about Storybook Docs, read the [general documentation](../README.md). To learn the Ember specifics, read on!

- [Installation](#installation)
- [DocsPage](#docspage)
- [Props tables](#props-tables)
- [MDX](#mdx)
- [IFrame height](#iframe-height)
- [More resources](#more-resources)

## Installation

First add the package. Make sure that the versions for your `@storybook/*` packages match:

```sh
yarn add -D @storybook/addon-docs
```

Then add the following to your `.storybook/main.js` addons:

```js
export default {
  addons: ['@storybook/addon-docs'],
};
```

## DocsPage

When you [install docs](#installation) you should get basic [DocsPage](../docs/docspage.md) documentation automagically for all your stories, available in the `Docs` tab of the Storybook UI.

## Props tables

Getting [Props tables](../docs/props-tables.md) for your components requires a few more steps. Docs for Ember relies on [@storybook/ember-cli-storybook addon](https://github.com/storybookjs/ember-cli-storybook), to extract documentation comments from your component source files. If you're using Storybook with Ember, you should already have this addon installed, you will just need to enable it by adding the following config block in your `ember-cli-build.js` file:

```js
let app = new EmberApp(defaults, {
  'ember-cli-storybook': {
    enableAddonDocsIntegration: true,
  },
});
```

Now, running the ember-cli server will generate a JSON documentation file at `/storybook-docgen/index.json`. Since generation of this file is tied into the ember-cli build, it will get regenerated everytime component files are saved. For details on documenting your components, check out the examples in the addon that powers the generation [ember-cli-addon-docs-yuidoc](https://github.com/ember-learn/ember-cli-addon-docs-yuidoc#documenting-components).

Next, add the following to your `.storybook/preview.js` to load the generated json file:

```js
import { setJSONDoc } from '@storybook/addon-docs/ember';
import docJson from '../dist/storybook-docgen/index.json';

setJSONDoc(docJson);
```

Finally, be sure to fill in the `component` field in your story metadata. This should be a string that matches the name of the `@class` used in your source comments:

```ts
export default {
  title: 'App Component',
  component: 'AppComponent',
};
```

If you haven't upgraded from `storiesOf`, you can use a parameter to do the same thing:

```ts
import { storiesOf } from '@storybook/angular';

storiesOf('App Component', module)
  .addParameters({ component: 'AppComponent' })
  .add( ... );
```

## MDX

[MDX](../docs/mdx.md) is a convenient way to document your components in Markdown and embed documentation components, such as stories and props tables, inline.

Docs has peer dependencies on `react`. If you want to write stories in MDX, you may need to add this dependency as well:

```sh
yarn add -D react
```

Then update your `.storybook/main.js` to make sure you load MDX files:

```js
export default {
  stories: ['../src/stories/**/*.stories.@(js|mdx)'],
};
```

Finally, you can create MDX files like this:

```md
import { Meta, Story, ArgsTable } from '@storybook/addon-docs';
import { hbs } from 'ember-cli-htmlbars';

<Meta title='App Component' component='AppComponent' />

# App Component

Some **markdown** description, or whatever you want.

<Story name='basic' height='400px'>{{
  template: hbs`<AppComponent @title={{title}} />`,
context: { title: "Title" },
}}</Story>

## ArgsTable

<ArgsTable of='AppComponent' />
```

Yes, it's redundant to declare `component` twice. [Coming soon](https://github.com/storybookjs/storybook/issues/8673).

Also, to use the `Props` doc block, you need to set up documentation generation, [as described above](#docspage).

## IFrame height

Storybook Docs renders all Ember stories inside `iframe`s, with a default height of `60px`. You can update this default globally, or modify the `iframe` height locally per story in `DocsPage` and `MDX`.

To update the global default, modify `.storybook/preview.js`:

```ts
export const parameters = { docs: { story: { iframeHeight: '400px' } } };
```

For `DocsPage`, you need to update the parameter locally in a story:

```ts
export const basic = () => ...
basic.parameters = {
  docs: { story: { iframeHeight: '400px' } }
}
```

And for `MDX` you can modify it as an attribute on the `Story` element:

```md
<Story name='basic' height='400px'>{...}</Story>
```

## More resources

Want to learn more? Here are some more articles on Storybook Docs:

- References: [DocsPage](../docs/docspage.md) / [MDX](../docs/mdx.md) / [FAQ](../docs/faq.md) / [Recipes](../docs/recipes.md) / [Theming](../docs/theming.md) / [Props](../docs/props-tables.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
