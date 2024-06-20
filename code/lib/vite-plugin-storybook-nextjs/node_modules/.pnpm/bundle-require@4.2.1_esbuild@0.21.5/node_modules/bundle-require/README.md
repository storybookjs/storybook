**💛 You can help the author become a full-time open-source maintainer by [sponsoring him on GitHub](https://github.com/sponsors/egoist).**

---

# bundle-require

[![npm version](https://badgen.net/npm/v/bundle-require)](https://npm.im/bundle-require) [![npm downloads](https://badgen.net/npm/dm/bundle-require)](https://npm.im/bundle-require) [![jsDocs.io](https://img.shields.io/badge/jsDocs.io-reference-blue)](https://www.jsdocs.io/package/bundle-require)

## Use Case

Projects like [Vite](https://vitejs.dev) need to load config files provided by the user, but you can't do it with just `require()` because it's not necessarily a CommonJS module, it could also be a `.mjs` or even be written in TypeScript, and that's where the `bundle-require` package comes in, it loads the config file regardless what module format it is.

## How it works

- Bundle your file with esbuild, `node_modules` are excluded because it's problematic to try to bundle it
  - `__filename`, `__dirname` and `import.meta.url` are replaced with source file's value instead of the one from the temporary output file
- Output file in `esm` format if possible (for `.ts`, `.js` input files)
- Load output file with `import()` if possible
- Return the loaded module and its dependencies (imported files)

## Install

```bash
npm i bundle-require esbuild
```

`esbuild` is a peer dependency.

## Usage

```ts
import { bundleRequire } from 'bundle-require'

const { mod } = await bundleRequire({
  filepath: './project/vite.config.ts',
})
```

## API

https://www.jsdocs.io/package/bundle-require

## Projects Using bundle-require

Projects that use **bundle-require**:

- [VuePress](https://github.com/vuejs/vuepress): :memo: Minimalistic Vue-powered static site generator.

## Sponsors

[![sponsors](https://sponsors-images.egoist.dev/sponsors.svg)](https://github.com/sponsors/egoist)

## License

MIT &copy; [EGOIST](https://github.com/sponsors/egoist)
