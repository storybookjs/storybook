# vite-plugin-storybook-nextjs

This is a Vite plugin that allows you to use Next.js features in Vite. It is the basis for `@storybook/experimental-nextjs-vite` and should be used when running portable stories in Vitest.

## Features

- **Next.js Integration**: Seamlessly integrate Next.js features into your Vite project.
- **Storybook Compatibility**: Acts as the foundation for `@storybook/experimental-nextjs-vite`, enabling you to use Storybook with Next.js in a Vite environment.
- **Portable Stories**: Ideal for running portable stories in Vitest, ensuring your components are tested in an environment that closely mirrors production.

## Installation

To install the plugin, use your package manager of choice:

```sh
npm install vite-plugin-storybook-nextjs
# or
yarn add vite-plugin-storybook-nextjs
# or
pnpm add vite-plugin-storybook-nextjs
```

## Usage

### Setup Vitest

To use the plugin, you need to set up Vitest in your project. You can do this by following the instructions in the [Vitest documentation](https://vitest.dev/guide/)

### Add the plugin to your vitest configuration

Add the plugin to your Vitest configuration file. This ensures that Vitest is aware of the Next.js features provided by the plugin.

```ts
// vitest.config.ts
import { defineConfig } from "vite";
import nextjs from "vite-plugin-storybook-nextjs";

export default defineConfig({
  plugins: [nextjs()],
});
```

### Usage with portable stories

[Portable stories](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest) are Storybook stories which can be used in external environments, such as Vitest.

This plugin is necessary to run portable stories in Vitest, as it provides the necessary Next.js features to ensure that your components are tested in an environment that closely mirrors production.

#### Experimental @storybook/experimental-vitest-plugin

The experimental `@storybook/experimental-vitest-plugin` can be used to automatically transform your stories at Vitest runtime to in-memory test files. This allows you to run your stories in a Vitest environment without needing to manually transform your stories. Please visit https://github.com/storybookjs/vitest-plugin for more information.

## Configuration Options

You can configure the plugin using the following options:

```ts
type VitePluginOptions = {
  /**
   * Provide the path to your Next.js project directory
   * @default process.cwd()
   */
  dir?: string;
};
```

## Limitations and differences to the Webpack5-based integration of Next.js in Storybook

### next/font staticDir mapping obsolete

You don't need to map your custom font directory in Storybook's staticDir configuration. Vite will automatically serve the files in the public directory and provide assets during production build.

### CSS/SASS

The `sassOptions` in `next.config.js` is not supported. Please use Vite's configuration options to configure the Sass compiler:

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

When using components that rely on Next.js Server Actions, there are some limitations to be aware of. Specifically, you need to ensure that your story files are set up to use the jsdom environment in Vitest for the case that your default Virtual DOM environment is set to happy-dom. This can be done by adding a special comment at the top of your story files:

```js
// @vitest-environment jsdom
```

This comment ensures that the components using Next.js Server Actions are properly handled in a jsdom environment, which is necessary for them to function correctly in Vitest.

## SWC Mode

Only Next.js in SWC mode is supported. If you were forced to opt out of Babel for some reason, you will very likely encounter issues with this plugin (e.g., emotion support in SWC is still lacking behind).

## License

This project is licensed under the MIT License.
