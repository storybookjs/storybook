<center>
  <img src="../docs/media/angular-hero.png" width="100%" />
</center>

<h1>Storybook Docs for Angular</h1>

> migration guide: This page documents the method to configure storybook introduced recently in 5.3.0, consult the [migration guide](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md) if you want to migrate to this format of configuring storybook.

Storybook Docs transforms your Storybook stories into world-class component documentation. Storybook Docs for Angular supports [DocsPage](../docs/docspage.md) for auto-generated docs, and [MDX](../docs/mdx.md) for rich long-form docs.

To learn more about Storybook Docs, read the [general documentation](../README.md). To learn the Angular specifics, read on!

- [Installation](#installation)
- [DocsPage](#docspage)
- [Props tables](#props-tables)
  - [Automatic Compodoc setup](#automatic-compodoc-setup)
- [Manual Compodoc setup](#manual-compodoc-setup)
- [MDX](#mdx)
- [IFrame height](#iframe-height)
- [Inline Stories](#inline-stories)
- [More resources](#more-resources)

## Installation

First add the package. Make sure that the versions for your `@storybook/*` packages match:

```sh
yarn add -D @storybook/addon-docs
```

Then add the following to your `.storybook/main.js` exports:

```js
export default {
  addons: ['@storybook/addon-docs'],
};
```

## DocsPage

When you [install docs](#installation) you should get basic [DocsPage](../docs/docspage.md) documentation automagically for all your stories, available in the `Docs` tab of the Storybook UI.

## Props tables

Getting [Props tables](../docs/props-tables.md) for your components requires a few more steps. Docs for Angular relies on [Compodoc](https://compodoc.app/), the excellent API documentation tool. It supports `inputs`, `outputs`, `properties`, `methods`, `view/content child/children` as first class prop types.

### Automatic Compodoc setup

During `sb init`, you will be asked, whether you want to setup Compodoc for your project. Just answer the question with Yes. Compodoc is then ready to use!

## Manual Compodoc setup

You'll need to register Compodoc's `documentation.json` file in `.storybook/preview.ts`:

```js
import { setCompodocJson } from '@storybook/addon-docs/angular';
import docJson from '../documentation.json';

setCompodocJson(docJson);
```

Finally, to set up compodoc, you'll first need to install Compodoc:

```sh
yarn add -D @compodoc/compodoc
```

Then you'll need to configure Compodoc to generate a `documentation.json` file. Adding the following snippet to your `projects.<project>.architect.<storybook|build-storybook>` in the `angular.json` creates a metadata file `./documentation.json` each time you run storybook:

```jsonc
// angular.json
{
  "projects": {
    "your-project": {
      "architect": {
        "storybook": {
          ...,
          "compodoc": true,
          "compodocArgs": [
            "-e",
            "json",
            "-d",
            "." // the root folder of your project
          ],
        },
        "build-storybook": {
          ...,
          "compodoc": true,
          "compodocArgs": [
            "-e",
            "json",
            "-d",
            "." // the root folder of your project
          ],
        }
      }
    }
  }
}
```

Unfortunately, it's not currently possible to update this dynamically as you edit your components, but [there's an open issue](https://github.com/storybookjs/storybook/issues/8672) to support this with improvements to Compodoc.

Finally, be sure to fill in the `component` field in your story metadata:

```ts
import { AppComponent } from './app.component';

export default {
  title: 'App Component',
  component: AppComponent,
};
```

If you haven't upgraded from `storiesOf`, you can use a parameter to do the same thing:

```ts
import { storiesOf } from '@storybook/angular';
import { AppComponent } from './app.component';

storiesOf('App Component', module)
  .addParameters({ component: AppComponent })
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
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
};
```

Finally, you can create MDX files like this:

```md
import { Meta, Story, ArgsTable } from '@storybook/addon-docs';
import { AppComponent } from './app.component';

<Meta title='App Component' component={AppComponent} />

# App Component

Some **markdown** description, or whatever you want.

<Story name='basic' height='400px'>{{
  component: AppComponent,
  props: {},
}}</Story>

## ArgsTable

<ArgsTable of={AppComponent} />
```

Yes, it's redundant to declare `component` twice. [Coming soon](https://github.com/storybookjs/storybook/issues/8673).

Also, to use the `Props` doc block, you need to set up Compodoc, [as described above](#docspage).

When you are using `template`, `moduleMetadata` and/or `addDecorators` with `storiesOf` then you can easily translate your story to MDX, too:

```md
import { Meta, Story, ArgsTable } from '@storybook/addon-docs';
import { CheckboxComponent, RadioButtonComponent } from './my-components';
import { moduleMetadata } from '@storybook/angular';

<Meta title='Checkbox' decorators={[
  moduleMetadata({
    declarations: [CheckboxComponent]
  })
]} />

# Basic Checkbox

<Story name='basic check' height='400px'>{{
  template: `
    <div class="some-wrapper-with-padding">
      <my-checkbox [checked]="checked">Some Checkbox</my-checkbox>
    </div>
  `,
  props: {
    checked: true
  }
}}</Story>

# Basic Radiobutton

<Story name='basic radio' height='400px'>{{
  moduleMetadata: {
    declarations: [RadioButtonComponent]
  }
  template: `
    <div class="some-wrapper-with-padding">
      <my-radio-btn [checked]="checked">Some Checkbox</my-radio-btn>
    </div>
  `,
  props: {
    checked: true
  }
}}</Story>
```

## IFrame height

Storybook Docs renders all Angular stories inside IFrames, with a default height of `60px`. You can update this default globally, or modify the IFrame height locally per story in `DocsPage` and `MDX`.

To update the global default, modify `.storybook/preview.ts`:

```ts
export const parameters = { docs: { story: { iframeHeight: '400px' } } };
```

For `DocsPage`, you need to update the parameter locally in a story:

```ts
export const basic = () => ...
basic.parameters = {
  docs: { story: { iframeHeight: '400px' } },
}
```

And for `MDX` you can modify it as an attribute on the `Story` element:

```md
<Story name='basic' height='400px'>{...}</Story>
```

## Inline Stories

Storybook Docs renders all Angular stories inline by default.

However, you can render stories in an iframe, with a default height of `100px` (configurable using the `docs.story.iframeHeight` story parameter), by using the `docs.story.inline` parameter.

To do so for all stories, update `.storybook/preview.js`:

```js
export const parameters = { docs: { story: { inline: false } } };
```

## More resources

Want to learn more? Here are some more articles on Storybook Docs:

- References: [DocsPage](../docs/docspage.md) / [MDX](../docs/mdx.md) / [FAQ](../docs/faq.md) / [Recipes](../docs/recipes.md) / [Theming](../docs/theming.md) / [Props](../docs/props-tables.md)
- Announcements: [Vision](https://medium.com/storybookjs/storybook-docs-sneak-peak-5be78445094a) / [DocsPage](https://medium.com/storybookjs/storybook-docspage-e185bc3622bf) / [MDX](https://medium.com/storybookjs/rich-docs-with-storybook-mdx-61bc145ae7bc) / [Framework support](https://medium.com/storybookjs/storybook-docs-for-new-frameworks-b1f6090ee0ea)
- Example: [Storybook Design System](https://github.com/storybookjs/design-system)
