# Storybook for Next.js <!-- omit in toc -->

## Table of Contents <!-- omit in toc -->

- [Supported Features](#supported-features)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
  - [In a project without Storybook](#in-a-project-without-storybook)
  - [In a project with Storybook](#in-a-project-with-storybook)
    - [Automatic migration](#automatic-migration)
    - [Manual migration](#manual-migration)
- [Documentation](#documentation)
  - [Options](#options)
  - [Next.js's Image Component](#nextjss-image-component)
    - [Local Images](#local-images)
    - [Remote Images](#remote-images)
  - [Next.js Font Optimization](#nextjs-font-optimization)
    - [next/font/google](#nextfontgoogle)
    - [next/font/local](#nextfontlocal)
    - [Not supported features of next/font](#not-supported-features-of-nextfont)
    - [Mocking fonts during testing](#mocking-fonts-during-testing)
  - [Next.js Routing](#nextjs-routing)
    - [Overriding defaults](#overriding-defaults)
    - [Global Defaults](#global-defaults)
    - [Default Router](#default-router)
    - [Actions Integration Caveats](#actions-integration-caveats)
  - [Next.js Navigation](#nextjs-navigation)
    - [Set `nextjs.appDirectory` to `true`](#set-nextjsappdirectory-to-true)
    - [Overriding defaults](#overriding-defaults-1)
    - [Global Defaults](#global-defaults-1)
    - [`useSelectedLayoutSegment` `useSelectedLayoutSegments` and `useParams` hook](#useselectedlayoutsegment-useselectedlayoutsegments-and-useparams-hook)
    - [Default Navigation Context](#default-navigation-context)
    - [Actions Integration Caveats](#actions-integration-caveats-1)
  - [Next.js Head](#nextjs-head)
  - [Sass/Scss](#sassscss)
  - [Css/Sass/Scss Modules](#csssassscss-modules)
  - [Styled JSX](#styled-jsx)
  - [Postcss](#postcss)
  - [Absolute Imports](#absolute-imports)
  - [Runtime Config](#runtime-config)
  - [Custom Webpack Config](#custom-webpack-config)
  - [Typescript](#typescript)
  - [Notes for Yarn v2 and v3 users](#notes-for-yarn-v2-and-v3-users)
  - [FAQ](#faq)
    - [Stories for pages/components which fetch data](#stories-for-pagescomponents-which-fetch-data)
    - [Statically imported images won't load](#statically-imported-images-wont-load)
    - [Module not found: Error: Can't resolve `package name`](#module-not-found-error-cant-resolve-package-name)
    - [What if I'm using the Vite builder?](#what-if-im-using-the-vite-builder)
- [Acknowledgements](#acknowledgements)

## Supported Features

👉 [Next.js's Image Component](#nextjss-image-component)

👉 [Next.js Font Optimization](#nextjs-font-optimization)

👉 [Next.js Routing (next/router)](#nextjs-routing)

👉 [Next.js Head (next/head)](#nextjs-head)

👉 [Next.js Navigation (next/navigation)](#nextjs-navigation)

👉 [Sass/Scss](#sassscss)

👉 [Css/Sass/Scss Modules](#csssassscss-modules)

👉 [Styled JSX](#styled-jsx)

👉 [Postcss](#postcss)

👉 [Absolute Imports](#absolute-imports)

👉 [Runtime Config](#runtime-config)

👉 [Custom Webpack Config](#custom-webpack-config)

👉 [Typescript](#typescript) (already supported out of the box by Storybook)

## Requirements

- [Next.js](https://nextjs.org/) >= 12.x
- [Storybook](https://storybook.js.org/) >= 7.x

## Getting Started

### In a project without Storybook

Follow the prompts after running this command in your Next.js project's root directory:

```bash
npx storybook@latest init
```

[More on getting started with Storybook](https://storybook.js.org/docs/react/get-started/install)

### In a project with Storybook

This framework is designed to work with Storybook 7. If you’re not already using v7, upgrade with this command:

```bash
npx storybook@latest upgrade
```

#### Automatic migration

When running the `upgrade` command above, you should get a prompt asking you to migrate to `@storybook/nextjs`, which should handle everything for you. In case that auto-migration does not work for your project, refer to the manual migration below.

#### Manual migration

Install the framework:

```bash
yarn add --dev @storybook/nextjs
```

Update your `main.js` to change the framework property:

```js
// .storybook/main.js
export default {
  // ...
  framework: {
    // name: '@storybook/react-webpack5', // Remove this
    name: '@storybook/nextjs', // Add this
    options: {
      builder: {
        // Set useSWC to true if you want to try out the experimental SWC compiler in Next.js >= 14.0.0
        useSWC: true,
      },
    },
  },
};
```

If you were using Storybook plugins to integrate with Next.js, those are no longer necessary when using this framework and can be removed:

```js
// .storybook/main.js
export default {
  // ...
  addons: [
    // ...
    // These can both be removed
    // 'storybook-addon-next',
    // 'storybook-addon-next-router',
  ],
};
```

## Documentation

### Options

You can be pass an options object for additional configuration if needed.

For example:

```js
// .storybook/main.js
import * as path from 'path';

export default {
  // ...
  framework: {
    name: '@storybook/nextjs',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(__dirname, '../next.config.js'),
    },
  },
};
```

- `image`: Props to pass to every instance of `next/image`
- `nextConfigPath`: The absolute path to the `next.config.js`

### Next.js's Image Component

[next/image](https://nextjs.org/docs/api-reference/next/image) is [notoriously difficult](https://github.com/vercel/next.js/issues/18393) to get working with Storybook. This framework allows you to use Next.js's `Image` component with no configuration!

#### Local Images

[Local images](https://nextjs.org/docs/basic-features/image-optimization#local-images) work just fine! Keep in mind that this feature was [only added in Next.js v11](https://nextjs.org/blog/next-11#automatic-size-detection-local-images).

```js
import Image from 'next/image';
import profilePic from '../public/me.png';

function Home() {
  return (
    <>
      <h1>My Homepage</h1>
      <Image
        src={profilePic}
        alt="Picture of the author"
        // width={500} automatically provided
        // height={500} automatically provided
        // blurDataURL="../public/me.png" set to equal the image itself (for this framework)
        // placeholder="blur" // Optional blur-up while loading
      />
      <p>Welcome to my homepage!</p>
    </>
  );
}
```

#### Remote Images

[Remote images](https://nextjs.org/docs/basic-features/image-optimization#remote-images) also work just fine!

```js
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <h1>My Homepage</h1>
      <Image src="/me.png" alt="Picture of the author" width={500} height={500} />
      <p>Welcome to my homepage!</p>
    </>
  );
}
```

### Next.js Font Optimization

[next/font](https://nextjs.org/docs/basic-features/font-optimization) is partially supported in Storybook. The packages `next/font/google` and `next/font/local` are supported.

#### next/font/google

You don't have to do anything. `next/font/google` is supported out of the box.

#### next/font/local

For local fonts you have to define the [src](https://nextjs.org/docs/api-reference/next/font#src) property.
The path is relative to the directory where the font loader function is called.

If the following component defines your localFont like this:

```js
// src/components/MyComponent.js
import localFont from 'next/font/local';

const localRubikStorm = localFont({ src: './fonts/RubikStorm-Regular.ttf' });
```

You have to tell Storybook where the `fonts` directory is located. The `from` value is relative to the `.storybook` directory. The `to` value is relative to the execution context of Storybook. Very likely it is the root of your project.

```js
// .storybook/main.js
export default {
  ...
  "staticDirs": [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts'
    }
  ],
}
```

#### Not supported features of next/font

The following features are not supported (yet). Support for these features might be planned for the future:

- [Support font loaders configuration in next.config.js](https://nextjs.org/docs/basic-features/font-optimization#specifying-a-subset)
- [fallback](https://nextjs.org/docs/api-reference/next/font#fallback) option
- [adjustFontFallback](https://nextjs.org/docs/api-reference/next/font#adjustfontfallback) option
- [declarations](https://nextjs.org/docs/api-reference/next/font#declarations) option
- [preload](https://nextjs.org/docs/api-reference/next/font#preload) option gets ignored. Storybook handles Font loading its own way.
- [display](https://nextjs.org/docs/api-reference/next/font#display) option gets ignored. All fonts are loaded with display set to "block" to make Storybook load the font properly.

#### Mocking fonts during testing

Occasionally fetching fonts from Google may fail as part of your Storybook build step. It is highly recommended to mock these requests, as those failures can cause your pipeline to fail as well. Next.js [supports mocking fonts](https://github.com/vercel/next.js/blob/725ddc7371f80cca273779d37f961c3e20356f95/packages/font/src/google/fetch-css-from-google-fonts.ts#L36) via a JavaScript module located where the env var `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` references.

For example, using [GitHub Actions](https://www.chromatic.com/docs/github-actions):

```shell
      - uses: chromaui/action@v1
        env:
          #👇 the location of mocked fonts to use
          NEXT_FONT_GOOGLE_MOCKED_RESPONSES: ${{ github.workspace }}/mocked-google-fonts.js
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

Your mocked fonts will look something like this:

```js
// mocked-google-fonts.js
//👇 Mocked responses of google fonts with the URL as the key
module.exports = {
  'https://fonts.googleapis.com/css?family=Inter:wght@400;500;600;800&display=block': `
    /* cyrillic-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url(https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhiJ-Ek-_EeAmM.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* more font declarations go here */
    /* latin */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url(https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }`,
};
```

### Next.js Routing

[Next.js's router](https://nextjs.org/docs/routing/introduction) is automatically stubbed for you so that when the router is interacted with, all of its interactions are automatically logged to the Actions ctions panel if you have the [Storybook actions addon](https://storybook.js.org/docs/react/essentials/actions).

> When using Next.js 13+, you should only use `next/router` in the `pages` directory. In the `app` directory, it is necessary to use `next/navigation`.

#### Overriding defaults

Per-story overrides can be done by adding a `nextjs.router` property onto the story [parameters](https://storybook.js.org/docs/react/writing-stories/parameters). The framework will shallowly merge whatever you put here into the router.

```js
// SomeComponentThatUsesTheRouter.stories.js
import SomeComponentThatUsesTheRouter from './SomeComponentThatUsesTheRouter';

export default {
  component: SomeComponentThatUsesTheRouter,
};

// If you have the actions addon,
// you can interact with the links and see the route change events there
export const Example = {
  parameters: {
    nextjs: {
      router: {
        pathname: '/profile/[id]',
        asPath: '/profile/1',
        query: {
          id: '1',
        },
      },
    },
  },
};
```

#### Global Defaults

Global defaults can be set in [preview.js](https://storybook.js.org/docs/react/configure/#configure-story-rendering) and will be shallowly merged with the default router.

```js
// .storybook/preview.js

export const parameters = {
  nextjs: {
    router: {
      pathname: '/some-default-path',
      asPath: '/some-default-path',
      query: {},
    },
  },
};
```

#### Default Router

The default values on the stubbed router are as follows (see [globals](https://storybook.js.org/docs/react/essentials/toolbars-and-globals#globals) for more details on how globals work)

```ts
const defaultRouter = {
  push(...args) {
    action('nextRouter.push')(...args);
    return Promise.resolve(true);
  },
  replace(...args) {
    action('nextRouter.replace')(...args);
    return Promise.resolve(true);
  },
  reload(...args) {
    action('nextRouter.reload')(...args);
  },
  back(...args) {
    action('nextRouter.back')(...args);
  },
  forward() {
    action('nextRouter.forward')();
  },
  prefetch(...args) {
    action('nextRouter.prefetch')(...args);
    return Promise.resolve();
  },
  beforePopState(...args) {
    action('nextRouter.beforePopState')(...args);
  },
  events: {
    on(...args) {
      action('nextRouter.events.on')(...args);
    },
    off(...args) {
      action('nextRouter.events.off')(...args);
    },
    emit(...args) {
      action('nextRouter.events.emit')(...args);
    },
  },
  // The locale should be configured [globally](https://storybook.js.org/docs/react/essentials/toolbars-and-globals#globals)
  locale: globals?.locale,
  asPath: '/',
  basePath: '/',
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  route: '/',
  pathname: '/',
  query: {},
};
```

#### Actions Integration Caveats

If you override a function, you lose the automatic actions integration and have to build it out yourself.

```js
// .storybook/preview.js

export const parameters = {
  nextjs: {
    router: {
      push() {
        // The default implementation that logs the action into the Actions panel is lost
      },
    },
  },
};
```

Doing this yourself looks something like this (make sure you install the `@storybook/addon-actions` package):

```js
// .storybook/preview.js
import { action } from '@storybook/addon-actions';

export const parameters = {
  nextjs: {
    router: {
      push(...args) {
        // Custom logic can go here
        // This logs to the Actions panel
        action('nextRouter.push')(...args);
        // Return whatever you want here
        return Promise.resolve(true);
      },
    },
  },
};
```

### Next.js Navigation

> Please note that [next/navigation](https://beta.nextjs.org/docs/upgrade-guide#step-5-migrating-routing-hooks) can only be used in components/pages in the `app` directory of Next.js 13+.

#### Set `nextjs.appDirectory` to `true`

If your story imports components that use `next/navigation`, you need to set the parameter `nextjs.appDirectory` to `true` in your Story:

```js
// SomeComponentThatUsesTheRouter.stories.js
import SomeComponentThatUsesTheNavigation from './SomeComponentThatUsesTheNavigation';

export default {
  component: SomeComponentThatUsesTheNavigation,
};

export const Example = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
},
```

If your Next.js project uses the `app` directory for every page (in other words, it does not have a `pages` directory), you can set the parameter `nextjs.appDirectory` to `true` in the [preview.js](https://storybook.js.org/docs/react/configure/#configure-story-rendering) file to apply it to all stories.

```js
// .storybook/preview.js

export const parameters = {
  nextjs: {
    appDirectory: true,
  },
};
```

The parameter `nextjs.appDirectory` defaults to `false` if not set.

#### Overriding defaults

Per-story overrides can be done by adding a `nextjs.navigation` property onto the story [parameters](https://storybook.js.org/docs/react/writing-stories/parameters). The framework will shallowly merge whatever you put here into the router.

```js
// SomeComponentThatUsesTheNavigation.stories.js
import SomeComponentThatUsesTheNavigation from './SomeComponentThatUsesTheNavigation';

export default {
  component: SomeComponentThatUsesTheNavigation,
};

// If you have the actions addon,
// you can interact with the links and see the route change events there
export const Example = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/profile',
        query: {
          user: '1',
        },
      },
    },
  },
};
```

#### Global Defaults

Global defaults can be set in [preview.js](https://storybook.js.org/docs/react/configure/#configure-story-rendering) and will be shallowly merged with the default router.

```js
// .storybook/preview.js

export const parameters = {
  nextjs: {
    appDirectory: true,
    navigation: {
      pathname: '/some-default-path',
    },
  },
};
```

#### `useSelectedLayoutSegment` `useSelectedLayoutSegments` and `useParams` hook

The `useSelectedLayoutSegment` `useSelectedLayoutSegments` and `useParams` hooks are supported in Storybook. You have to set the `nextjs.navigation.segments` parameter to return the segments or the params you want to use.

```js
// SomeComponentThatUsesTheNavigation.stories.js
import SomeComponentThatUsesTheNavigation from './SomeComponentThatUsesTheNavigation';

export default {
  component: SomeComponentThatUsesTheNavigation,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: ['dashboard', 'analytics']
      },
    },
  },
};

export const Example = {};

// SomeComponentThatUsesTheNavigation.js
import { useSelectedLayoutSegment, useSelectedLayoutSegments, useParams } from 'next/navigation';

export default function SomeComponentThatUsesTheNavigation() {
  const segment = useSelectedLayoutSegment(); // dashboard
  const segments = useSelectedLayoutSegments(); // ["dashboard", "analytics"]
  const params = useParams(); // {}
  ...
}
```

To use `useParams`, you have to use a two string elements array for a segment, the first array element is the param key and the second array element is the param value.

```js
// SomeComponentThatUsesParams.stories.js
import SomeComponentThatUsesParams from './SomeComponentThatUsesParams';

export default {
  component: SomeComponentThatUsesParams,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [
          ['slug', 'hello'],
          ['framework', 'nextjs'],
        ]
      },
    },
  },
};

export const Example = {};

// SomeComponentThatUsesParams.js
import { useSelectedLayoutSegment, useSelectedLayoutSegments, useParams } from 'next/navigation';

export default function SomeComponentThatUsesParams() {
  const segment = useSelectedLayoutSegment(); // hello
  const segments = useSelectedLayoutSegments(); // ["hello", "nextjs"]
  const params = useParams(); // { slug: "hello", framework: "nextjs" }
  ...
}
```

The default value of `nextjs.navigation.segments` is `[]` if not set.

#### Default Navigation Context

The default values on the stubbed navigation context are as follows:

```ts
const defaultNavigationContext = {
  push(...args) {
    action('nextNavigation.push')(...args);
  },
  replace(...args) {
    action('nextNavigation.replace')(...args);
  },
  forward(...args) {
    action('nextNavigation.forward')(...args);
  },
  back(...args) {
    action('nextNavigation.back')(...args);
  },
  prefetch(...args) {
    action('nextNavigation.prefetch')(...args);
  },
  refresh: () => {
    action('nextNavigation.refresh')();
  },
  pathname: '/',
  query: {},
};
```

#### Actions Integration Caveats

If you override a function, you lose the automatic action tab integration and have to build it out yourself.

```js
// .storybook/preview.js

export const parameters = {
  nextjs: {
    appDirectory: true,
    navigation: {
      push() {
        // The default implementation that logs the action into the Actions panel is lost
      },
    },
  },
};
```

Doing this yourself looks something like this (make sure you install the `@storybook/addon-actions` package):

```js
// .storybook/preview.js
import { action } from '@storybook/addon-actions';

export const parameters = {
  nextjs: {
    appDirectory: true,
    navigation: {
      push(...args) {
        // Custom logic can go here
        // This logs to the Actions panel
        action('nextNavigation.push')(...args);
        // Return whatever you want here
        return Promise.resolve(true);
      },
    },
  },
};
```

### Next.js Head

[next/head](https://nextjs.org/docs/api-reference/next/head) is supported out of the box. You can use it in your stories like you would in your Next.js application. Please keep in mind, that the Head children are placed into the head element of the iframe that Storybook uses to render your stories.

### Sass/Scss

[Global sass/scss stylesheets](https://nextjs.org/docs/basic-features/built-in-css-support#sass-support) are supported without any additional configuration as well. Just import them into [preview.js](https://storybook.js.org/docs/react/configure/#configure-story-rendering)

```js
import '../styles/globals.scss';
```

This will automatically include any of your [custom sass configurations](https://nextjs.org/docs/basic-features/built-in-css-support#customizing-sass-options) in your `next.config.js` file.

```js
// next.config.js
import * as path from 'path';

export default {
  // Any options here are included in Sass compilation for your stories
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
  },
};
```

### Css/Sass/Scss Modules

[css modules](https://nextjs.org/docs/basic-features/built-in-css-support#adding-component-level-css) work as expected.

```js
// This import works just fine in Storybook now
import styles from './Button.module.css';
// sass/scss is also supported
// import styles from './Button.module.scss'
// import styles from './Button.module.sass'

export function Button() {
  return (
    <button type="button" className={styles.error}>
      Destroy
    </button>
  );
}
```

### Styled JSX

The built in CSS-in-JS solution for Next.js is [styled-jsx](https://nextjs.org/docs/basic-features/built-in-css-support#css-in-js), and this framework supports that out of the box too, zero config.

```js
// This works just fine in Storybook now
function HelloWorld() {
  return (
    <div>
      Hello world
      <p>scoped!</p>
      <style jsx>{`
        p {
          color: blue;
        }
        div {
          background: red;
        }
        @media (max-width: 600px) {
          div {
            background: blue;
          }
        }
      `}</style>
      <style global jsx>{`
        body {
          background: black;
        }
      `}</style>
    </div>
  );
}

export default HelloWorld;
```

You can use your own babel config too. This is an example of how you can customize styled-jsx.

```json
// .babelrc or whatever config file you use
{
  "presets": [
    [
      "next/babel",
      {
        "styled-jsx": {
          "plugins": ["@styled-jsx/plugin-sass"]
        }
      }
    ]
  ]
}
```

### Postcss

Next.js lets you [customize postcss config](https://nextjs.org/docs/advanced-features/customizing-postcss-config#default-behavior). Thus this framework will automatically handle your postcss config for you.

This allows for cool things like zero config tailwindcss! (See [Next.js' example](https://github.com/vercel/next.js/tree/canary/examples/with-tailwindcss))

### Absolute Imports

Goodbye `../`! Absolute imports from the root directory work just fine.

```js
// All good!
import Button from 'components/button';
// Also good!
import styles from 'styles/HomePage.module.css';

export default function HomePage() {
  return (
    <>
      <h1 className={styles.title}>Hello World</h1>
      <Button />
    </>
  );
}
```

Also OK for global styles in `preview.js`!

```js
// .storybook/preview.js

import 'styles/globals.scss';

// ...
```

### Runtime Config

Next.js allows for [Runtime Configuration](https://nextjs.org/docs/api-reference/next.config.js/runtime-configuration) which lets you import a handy `getConfig` function to get certain configuration defined in your `next.config.js` file at runtime.

In the context of Storybook with this framework, you can expect Next.js's [Runtime Configuration](https://nextjs.org/docs/api-reference/next.config.js/runtime-configuration) feature to work just fine.

Note, because Storybook doesn't server render your components, your components will only see what they normally see on the client side (i.e. they won't see `serverRuntimeConfig` but will see `publicRuntimeConfig`).

For example, consider the following Next.js config:

```js
// next.config.js
module.exports = {
  serverRuntimeConfig: {
    mySecret: 'secret',
    secondSecret: process.env.SECOND_SECRET, // Pass through env variables
  },
  publicRuntimeConfig: {
    staticFolder: '/static',
  },
};
```

Calls to `getConfig` would return the following object when called within Storybook:

```json
{
  "serverRuntimeConfig": {},
  "publicRuntimeConfig": {
    "staticFolder": "/static"
  }
}
```

### Custom Webpack Config

Next.js comes with a lot of things for free out of the box like sass support, but sometimes you add [custom webpack config modifications to Next.js](https://nextjs.org/docs/api-reference/next.config.js/custom-webpack-config). This framework takes care of most of the webpack modifications you would want to add. If Next.js supports a feature out of the box, then that feature will work out of the box in Storybook. If Next.js doesn't support something out of the box, but makes it easy to configure, then this framework will do the same for that thing for Storybook.

Any webpack modifications desired for Storybook should be made in [.storybook/main.js](https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config).

Note: Not all webpack modifications are copy/paste-able between `next.config.js` and `.storybook/main.js`. It is recommended to do your research on how to properly make your modification to Storybook's webpack config and on how [webpack works](https://webpack.js.org/concepts/).

Below is an example of how to add svgr support to Storybook with this framework.

```js
// .storybook/main.js
export default {
  // ...
  webpackFinal: async (config) => {
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];

    // This modifies the existing image rule to exclude .svg files
    // since you want to handle those files with @svgr/webpack
    const imageRule = config.module.rules.find((rule) => rule?.['test']?.test('.svg'));
    if (imageRule) {
      imageRule['exclude'] = /\.svg$/;
    }

    // Configure .svg files to be loaded with @svgr/webpack
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};
```

### Typescript

Storybook handles most [Typescript](https://www.typescriptlang.org/) configurations, but this framework adds additional support for Next.js's support for [Absolute Imports and Module path aliases](https://nextjs.org/docs/advanced-features/module-path-aliases). In short, it takes into account your `tsconfig.json`'s [baseUrl](https://www.typescriptlang.org/tsconfig#baseUrl) and [paths](https://www.typescriptlang.org/tsconfig#paths). Thus, a `tsconfig.json` like the one below would work out of the box.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/components/*": ["components/*"]
    }
  }
}
```

### Notes for Yarn v2 and v3 users

If you're using [Yarn](https://yarnpkg.com/) v2 or v3, you may run into issues where Storybook can't resolve `style-loader` or `css-loader`. For example, you might get errors like:

`Module not found: Error: Can't resolve 'css-loader'`\
`Module not found: Error: Can't resolve 'style-loader'`

This is because those versions of Yarn have different package resolution rules than Yarn v1.x. If this is the case for you, just install the package directly.

### FAQ

#### Stories for pages/components which fetch data

Next.js page files can contain imports to modules meant to run in a node environment (for use in data fetching functions). If you import from a Next.js page file containing those node module imports in your stories, your Storybook's Webpack will crash because those modules will not run in a browser. To get around this, you can extract the component in your page file into a separate file and import that pure component in your stories. Or, if that's not feasible for some reason, you can [polyfill those modules](https://webpack.js.org/configuration/node/) in your Storybook's [`webpackFinal` configuration](https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config).

**Before**

```jsx
// ./pages/my-page.jsx
import fs from 'fs';

// Using this component in your stories will break the Storybook build
export default function Page(props) {
  return; // ...
}

export const getStaticProps = async () => {
  // Logic that uses `fs`
};
```

**After**

```jsx
// ./pages/my-page.jsx
import fs from 'fs';

// Use this pure component in your stories instead
import MyPage from 'components/MyPage';

export default function Page(props) {
  return <MyPage {...props} />;
}

export const getStaticProps = async () => {
  // Logic that uses `fs`
};
```

Starting with Next.js 13, you can also fetch data directly within server components in the `app` directory. This does not (currently) work within Storybook for similar reasons as above. It can be worked around similarly as well, by extracting a pure component to a separate file and importing that component in your stories.

**Before**

```jsx
// ./app/my-page/index.jsx
async function getData() {
  const res = await fetch(...);
  // ...
}

// Using this component in your stories will break the Storybook build
export default async function Page() {
  const data = await getData();

  return // ...
}
```

**After**

```jsx
// ./app/my-page/index.jsx

// Use this component in your stories
import MyPage from './components/MyPage';

async function getData() {
  const res = await fetch(...);
  // ...
}

export default async function Page() {
  const data = await getData();

  return <MyPage {...data} />;
}
```

#### Statically imported images won't load

Make sure you are treating image imports the same way you treat them when using `next/image` in normal development.

Before using this framework, image imports just imported the raw path to the image (e.g. `'static/media/stories/assets/logo.svg'`). Now image imports work the "Next.js way", meaning that you now get an object when importing an image. For example:

```json
{
  "src": "static/media/stories/assets/logo.svg",
  "height": 48,
  "width": 48,
  "blurDataURL": "static/media/stories/assets/logo.svg"
}
```

Therefore, if something in storybook isn't showing the image properly, make sure you expect the object to be returned from an import instead of just the asset path.

See [local images](https://nextjs.org/docs/basic-features/image-optimization#local-images) for more detail on how Next.js treats static image imports.

#### Module not found: Error: Can't resolve `package name`

You might get this if you're using Yarn v2 or v3. See [Notes for Yarn v2 and v3 users](#notes-for-yarn-v2-and-v3-users) for more details.

#### What if I'm using the Vite builder?

The `@storybook/nextjs` package abstracts the Webpack 5 builder and provides all the necessary Webpack configuration needed (and used internally) by Next.js. Webpack is currently the official builder in Next.js, and Next.js does not support Vite, therefore it is not possible to use Vite with `@storybook/nextjs`. You can use `@storybook/react-vite` framework instead, but at the cost of having a degraded experience, and we won't be able to provide you official support.

## Acknowledgements

This framework borrows heavily from these Storybook addons:

- [storybook-addon-next](https://github.com/RyanClementsHax/storybook-addon-next) by [RyanClementsHax](https://github.com/RyanClementsHax/)
- [storybook-addon-next-router](https://github.com/lifeiscontent/storybook-addon-next-router) by [lifeiscontent](https://github.com/lifeiscontent)
