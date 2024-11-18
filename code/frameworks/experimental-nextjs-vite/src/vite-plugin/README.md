# vite-plugin-storybook-nextjs

This is a Vite plugin that allows you to use Next.js features in Vite. It is the basis for `@storybook/experimental-nextjs-vite` and should be used when running portable stories in Vitest.

## Features

- **Next.js Integration**: Seamlessly integrate Next.js features into your Vite project.
- **Storybook Compatibility**: Acts as the foundation for [the `@storybook/experimental-nextjs-vite` framework](https://storybook.js.org/docs/get-started/frameworks/nextjs#with-vite), enabling you to use Storybook with Next.js in a Vite environment.
- **Portable Stories**: Ideal for running portable stories in Vitest, ensuring your components are tested in an environment that closely mirrors production.

## Requirements

- Next.js v14.1.0 or higher

## Installation

Install the plugin using your preferred package manager:

```sh
npm install vite-plugin-storybook-nextjs
# or
yarn add vite-plugin-storybook-nextjs
# or
pnpm add vite-plugin-storybook-nextjs
```

## Usage

### Set up Vitest

To use the plugin, you need to set up Vitest in your project. You can do this by following the instructions in the [Vitest documentation](https://vitest.dev/guide/).

### Add the plugin to your Vitest configuration

Add the plugin to your Vitest configuration file. This ensures that Vitest is aware of the Next.js features provided by the plugin.

```ts
// vitest.config.ts
import { defineConfig } from 'vite';
import nextjs from 'vite-plugin-storybook-nextjs';

export default defineConfig({
  plugins: [nextjs()],
});
```

If you are using `@storybook/experimental-nextjs-vite` you don't have to install `vite-plugin-storybook-nextjs`, since `@storybook/experimental-nextjs-vite` already re-exports it.

```ts
// vitest.config.ts
import { storybookNextJsPlugin } from '@storybook/experimental-nextjs-vite/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [storybookNextJsPlugin()],
});
```

## Configuration Options

You can configure the plugin using the following options:

```ts
type VitePluginOptions = {
  /**
   * Provide the path to your Next.js project directory
   *
   * @default process.cwd()
   */
  dir?: string;
};
```

## Usage with portable stories

[Portable stories](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest) are Storybook stories which can be used in external environments, such as Vitest.

This plugin is necessary to run portable stories in Vitest, as it provides the necessary Next.js features to ensure that your components are tested in an environment that closely mirrors production.

## Automatic story transformation

(⚠️ **Experimental**)

The experimental `@storybook/experimental-addon-test` can be used to automatically transform your stories at Vitest runtime to in-memory test files. This allows you to run your stories in a Vitest environment without needing to manually transform your stories. Please visit https://storybook.js.org/docs/8.3/writing-tests/test-runner-with-vitest for more information.

## Limitations and differences to the Webpack5-based integration of Next.js in Storybook

### `next/font` `staticDir` mapping obsolete

You don't need to map your custom font directory in Storybook's `staticDir` configuration. Instead, Vite will automatically serve the files in the `public` directory and provide assets during production builds.

### CSS/SASS

The `sassOptions` property in `next.config.js` is not supported. Please use Vite's configuration options to configure the Sass compiler:

```js
css: {
  preprocessorOptions: {
    scss: {
      quietDeps: true
    },
  }
},
```

### Next.js: Server Actions

When testing components that rely on Next.js Server Actions, you need to ensure that your story files are [set up to use the `jsdom` environment in Vitest](https://vitest.dev/config/#environment). This can be done in two ways:

1. To apply it to individual story files, add a special comment at the top of each file:

   ```js
   // @vitest-environment jsdom
   ```

2. To apply it to all tests, adjust your Vitest configuration:

   ```ts
   // vitest.config.ts
   import { defineConfig } from 'vitest/config';
   import nextjs from 'vite-plugin-storybook-nextjs';
   
   export default defineConfig({
     plugins: [nextjs()],
     test: {
       environment: 'jsdom', // 👈 Add this
     },
   });
   ```

### SWC Mode

Only [Next.js in SWC mode](https://nextjs.org/docs/architecture/nextjs-compiler) is supported. If your project was forced to opt out of Babel for some reason, you will very likely encounter issues with this plugin (e.g., Emotion support in SWC is still lagging behind).

## License

This project is licensed under the MIT License.
