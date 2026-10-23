# Builder-Webpack5

Builder implemented with `webpack5` and `webpack5`-compatible loaders/plugins/config, used by `@storybook/core-server` to build the preview iframe.

```js
export default {
  core: {
    builder: '@storybook/builder-webpack5',
  },
};
```

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).

## TurboSnap output evidence

Production preview stats include optional output evidence for TurboSnap 2. The evidence fingerprints
final emitted chunks, including loader and plugin effects, while preserving the existing module stats.
Core verifies the recorded bytes after the build finishes and accounts for remaining output files.

Collection requires an explicit `--stats-json` request (or the legacy `--webpack-stats-json` alias).
Without it, the builder does not load the evidence collector or register its compilation hook, and
core skips the evidence inventories, hashes, and extra diagnostic rendering.

Story fingerprints cover whole reachable chunks. Shared code placed in a story chunk can therefore
widen coverage to another story. Global preview imports and scripts or preloads in `iframe.html` keep
their reachable chunks globally covered. Only the unchanged generated Storybook story loader is
allowed to introduce story-scoped imports.

The producer captures each compiler-rendered JavaScript chunk before asset processing, including
its module factories and startup wrapper. Final code must match that snapshot or its default
minified form after parsing and printing. Final code is never optimized during comparison, so
optimizer annotations cannot hide added calls. Unknown render hooks,
custom runtime generators, and post-render JavaScript changes produce incomplete evidence. This
includes plugins that inject eager imports, runtime aliases, dynamic evaluation, or new chunk
callbacks after Webpack builds its dependency graph. Storybook's default Webpack minification
remains supported.

The producer normalizes only validated generated chunk URL hashes in Webpack's runtime, their owned
source-map references, and parsed HTML resource references. Unrecognized runtime formats, inline
runtimes mixed with application code, ambiguous chunk identities, and unsupported source-map shapes
produce incomplete evidence. A final file mutation also invalidates the evidence. TurboSnap then
retains its existing conservative behavior.

Code that references `currentScript` retains its chunk filename and the filenames of transitive
importers in global coverage. Banners that add executable code after rendering produce incomplete
evidence. This is conservative when Webpack automatically derives its public path. Output evidence
validates the supported compiler output; it does not establish dependencies for
arbitrary dynamic evaluation or handwritten runtime access already present in application source.

Run the repeatable React and Next.js build matrix from the repository root after compiling the
packages:

```sh
yarn node scripts/turbosnap-output-matrix.ts --framework react-webpack5
yarn node scripts/turbosnap-output-matrix.ts --framework nextjs
```

Pass `--cli /absolute/path/to/compiled-cli.js` to validate each fresh build with the CLI manifest command.
