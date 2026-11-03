# Resolutions and Exact versions

This file keeps track of any resolutions or exact versions specified in any `package.json` file. Resolutions are used to specify a specific version of a package to be used, even if a different version is specified as a dependency of another package.

## path/to/package.json

example-library@3.4.6 (bug: 3.5.x): Pinned as there is a bug in version 3.5.x that prevents foo from doing bar.

## package.json

dom-accessibility-api@^0.6.3 (for `^0.5.9` and `^0.5.14`): `@testing-library/dom` asks for 0.5 while `@testing-library/jest-dom` 7 asks for 0.6, so `storybook/test` would bundle both. 0.6 only adds `isDisabled`, support for `aria-description` and the `none` role.

