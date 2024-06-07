# Parser

- `analyse/` directory is for functions to analyse the extracted AST nodes,
  and get specific piece of data needed for further processing.

- `extract/` directory is for functions to extract AST nodes:

  1. From original Svelte source code,
     before transformation with `vite` plugins begins.
     Powered by `svelte/compiler`.

  2. From post-transformed compiled code with `vite` plugins.
     Powered by `vite`'s _(uses `rollup` internally)_ - [`this.parse()`](https://rollupjs.org/plugin-development/#this-parse).
