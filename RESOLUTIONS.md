# Resolutions and Exact versions

This file keeps track of any resolutions or exact versions specified in any `package.json` file. Resolutions are used to specify a specific version of a package to be used, even if a different version is specified as a dependency of another package.

## code/renderers/svelte/package.json

svelte-check@3.4.6 (bug: 3.5.x): Type issues

## code/ui/components/package.json

overlayscrollbars@2.2.1 (bug: 2.3.x): The Scrollbar doesn't disappear anymore by default. It might has something to do with the `scrollbars.autoHideSuspend` option, which was introduced in 2.3.0. https://github.com/KingSora/OverlayScrollbars/blob/master/packages/overlayscrollbars/CHANGELOG.md#230