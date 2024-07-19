## Bugs

- Readd functionality so that Vite plugin works in Storybook mode
  -- Fast refresh
- Sourcemaps broken

## Features

- [x] SWC transpiler
- [x] Environment variables
- [ ] CSS
  - [x] Global CSS
  - [x] CSS Modules
  - [x] External Stylesheets
  - [x] Tailwind CSS
  - [x] Sass
  - [x] CSS-in-JS
- [x] next/link
- [ ] next/image
- [x] next/font
- [ ] next/head
- [ ] next/cache
- [ ] next/navigation
- [ ] Fast Refresh (WIP - `fast-refresh` branch (latest `wip` commit contains the work))

## Limitations

### Project Root

- process.env.STORYBOOK_PROJECT_ROOT not supported yet

### CSS

#### Sass

##### [Custom](https://nextjs.org/docs/app/building-your-application/styling/sass#customizing-sass-options)

The sassOptions in `next.config.js` is not supported. Please use Vite's configuration options to configure the sass compiler:

```js
css: {
    preprocessorOptions: {
        scss: {
            quietDeps: true
        },
    }
},
```
