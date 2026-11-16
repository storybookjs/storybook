import { StorybookError } from 'storybook/internal/preview-errors';

// The framework owns this category, so no other package uses its codes
const CATEGORY = 'FRAMEWORK_SVELTEKIT';

export class SvelteKitMockParametersRemovedError extends StorybookError {
  constructor(public data: { keys: string[] }) {
    super({
      name: 'SvelteKitMockParametersRemovedError',
      category: CATEGORY,
      code: 1,
      documentation: [
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed',
        'https://storybook.js.org/docs/get-started/frameworks/sveltekit#mocking-modules',
      ],
      message: [
        `\`parameters.sveltekit_experimental\` was removed in Storybook 11, and this story still sets it: ${data.keys.map((key) => `\`${key}\``).join(', ')}.`,
        '',
        'Mock SvelteKit modules in `beforeEach` instead. Import `goto` and the other functions from `$app/navigation`, set `page` from `$app/state`, and use `link` and `setAfterNavigate` from `@storybook/sveltekit/navigation.mock` and `formAction` from `@storybook/sveltekit/forms.mock`. The migration guide maps every key to its replacement, and `npx storybook automigrate sveltekit-mocking-before-each` rewrites them for you.',
      ].join('\n'),
    });
  }
}

export class SvelteKitMocksSharedOnDocsPageError extends StorybookError {
  constructor() {
    super({
      name: 'SvelteKitMocksSharedOnDocsPageError',
      category: CATEGORY,
      code: 2,
      documentation: 'https://storybook.js.org/docs/get-started/frameworks/sveltekit#docs-pages',
      // Short lines: a docs page shows this in a box that doesn't wrap them
      message: [
        "Inline stories can't set up SvelteKit mocks.",
        '',
        'To fix this, render the stories of this file in iframes. Add this',
        'to the meta (`defineMeta()` or the default export):',
        '',
        '  parameters: { docs: { story: { inline: false } } }',
        '',
        'Inline stories render in one document, so they share the mocks of',
        '`$app/state`, `$app/navigation` and `$app/forms`. Every story would',
        'show the setup of the story that ran last, so Storybook stops here.',
        'In an iframe, each story has its own mocks.',
        '',
        'A story sets up the mocks when its `beforeEach` sets `page`,',
        '`navigating` or `updated`, calls `setAfterNavigate()`, or',
        'configures a mock function such as `goto` or `formAction`.',
      ].join('\n'),
    });
  }
}
