---
title: 'Styling and CSS'
---

There are many ways to include CSS in a web application, and correspondingly there are many ways to include CSS in Storybook. Usually, it is best to try and replicate what your application does with styling in Storybook’s configuration.

If you're using Vite to build your Storybook, you're covered! Storybook will use your vite config file which supports most popular styling tools out-of-the-box 🎉. However, if you're using Webpack, you may need some extra configuration. To make this easier, we recommend using [`@storybook/addon-styling-webpack`](https://storybook.js.org/addons/@storybook/addon-styling-webpack/).

**Note**: If you're using Storybook with Angular or Next.js, you can skip this section. Storybook will automatically use the same styling configuration as your application.

## Importing CSS files

Storybook is pre-configured to recognize imports for CSS files. To add global CSS for all your stories, import it in [`.storybook/preview.js`](./index.md#configure-story-rendering).

<CodeSnippets
paths={[
'common/storybook-preview-import-global-styles.js.mdx',
'common/storybook-preview-import-global-styles.ts.mdx',
]}
/>

If your component files import their CSS files, this will work too. The noticeable exception to this is if you're using CSS processor tools like Sass or Postcss.

## CSS processors

If you're using Vite as your builder, you're covered! Vite supports Sass and PostCSS out-of-the-box 🎉

However, if you're using Webpack and want to use Sass and PostCss, you'll need some extra configuration. We recommend installing [`@storybook/addon-styling-webpack`](https://storybook.js.org/addons/@storybook/addon-styling-webpack/) to help you configure these tools. Or if you'd prefer, you can customize [Storybook's webpack configuration yourself](../builders/webpack.md#override-the-default-configuration) to include the appropriate loader(s).

## CSS-in-JS

CSS-in-JS libraries are designed to use basic JavaScript, and they often work in Storybook without any extra configuration. Some libraries expect components to render in a specific rendering “context” (for example, to provide themes), which can be accomplished with `@storybook/addon-themes`'s [`withThemeFromJSXProvider` decorator](https://github.com/storybookjs/storybook/blob/next/code/addons/themes/docs/api.md#withthemefromjsxprovider).

## Adding webfonts

If you need webfonts to be available, you may need to add some code to the [`.storybook/preview-head.html`](./story-rendering.md#adding-to-head) file. We recommend including any assets with your Storybook if possible, in which case you likely want to configure the [static file location](./images-and-assets.md#serving-static-files-via-storybook-configuration).

<IfRenderer renderer='angular'>

## Troubleshooting

### Styles aren't being applied with Angular

The latest Angular releases introduced significant changes in configuring and styling projects. If you're working with an Angular version greater than 13 and your styles aren't being applied, you may need to check your `angular.json` and adjust the `builder` configuration to import your CSS:

```json
{
  "my-project": {
    "architect": {
      "build": {
        "builder": "@angular-devkit/build-angular:browser",
        "options": {
          "styles": ["src/styles.css", "src/styles.scss"]
        }
      }
    }
  }
}
```

Additionally, if you need Storybook-specific styles that are separate from your application, you can configure the styles with [Storybook's custom builder](../get-started/install.md#troubleshooting), which will override the application's styles:

```json
{
  "storybook": {
    "builder": "@storybook/angular:start-storybook",
    "options": {
      "browserTarget": "my-default-project:build",
      "styles": [".storybook/custom-styles.scss"]
    }
  }
}
```

### NX component libraries not loading styles

If you're working with Storybook and [Nx libraries](https://nx.dev/structure/library-types),
you can extend your project's configuration (i.e., `project.json`) and provide the application's styles.

For earlier Nx versions (before `14.1.8`), your configuration would look like this:

```json
 "build-storybook": {
    "executor": "@nrwl/storybook:build",
    "outputs": ["{options.outputPath}"],
    "options": {
      "uiFramework": "@storybook/angular",
      "outputPath": "dist/storybook/example-lib",
      "config": {
        "configFolder": "libs/example-lib/storybook/.storybook"
      },
      "projectBuildConfig": "example-lib:build-storybook",
      "styles": ["apps/example-app/src/styles.scss"]
    }
  }
```

Starting with version `14.1.8`, Nx uses the Storybook builder directly, which means any configuration supplied to the builder also applies to the NX setup. If you're working with a library, you'll need to configure the styling options ( e.g., preprocessors) inside the `build-storybook` `options` configuration object. For example:

```json
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
        "configDir": "apps/example-lib/.storybook",
        "browserTarget": "example-lib:build-storybook",
      },
    },
    "build-storybook": {
      "executor": "@storybook/angular:build-storybook",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputDir": "dist/storybook/example-lib",
        "configDir": "apps/example-lib/.storybook",
        "browserTarget": "example-lib:build-storybook",
        "styles": [".storybook/custom-styles.scss"],
        "stylePreprocessorOptions": {
          "includePaths": [
            "libs/design-system/src/lib"
          ]
        }
      }
    }
```

When Nx runs, it will load Storybook's configuration and styling based on [`storybook`'s `browserTarget`](https://nx.dev/storybook/extra-topics-for-angular-projects#setting-up-browsertarget).

</IfRenderer>
