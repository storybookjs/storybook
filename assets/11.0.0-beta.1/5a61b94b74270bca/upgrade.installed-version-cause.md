# upgrade.installed-version: cause

Symptom: after `yarn dlx storybook@11.0.0-beta.1 upgrade --yes`, `require('storybook/package.json').version` run from packages/twenty-front prints 10.6.3 (see installed-version-after-upgrade.txt). `@storybook/react-vite` and the other @storybook/* packages in twenty-front are 11.0.0-beta.1.

Cause: twenty-front does not declare `storybook` itself. The `storybook` CLI package resolves to the hoisted root copy, which is pinned by a sibling workspace:
- packages/twenty-ui/package.json:68 `"storybook": "^10.6.3"`
- packages/twenty-front-component-renderer/package.json:51 `"storybook": "^10.6.3"`

The upgrade bumped twenty-front/package.json and the @storybook/* packages it declares. It did not bump the `storybook` CLI, which is not declared in twenty-front, and it did not touch the sibling workspace pins. Result: the CLI binary used by twenty-front (node_modules/.bin/storybook) is 10.6.3 while the framework and addons are 11.0.0-beta.1. Doctor reported "The storybook package was not found in your package.json" but did not report the version split.

Fix tried: add `"storybook": "^11.0.0-beta.1"` to packages/twenty-front devDependencies (the direct dependency doctor asks for), then re-run yarn install. twenty-ui keeps its 10.6.3 pin, so yarn should nest the 11 copy under packages/twenty-front.
