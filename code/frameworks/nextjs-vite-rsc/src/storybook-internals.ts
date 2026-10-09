import { instrument } from 'storybook/internal/instrumenter';
import type { TagsOptions } from 'storybook/internal/types';

import { screen, within } from 'storybook/test';

// The parts of Storybook that the framework uses at runtime and that are not its API, each with
// the API that would replace it.

// `screen` queries the `<body>` the document had when `storybook/test` loaded, and a page of the
// app gets a `<body>` of its own, as in a browser. This replaces the queries of `screen` with
// instrumented ones of the new body, so the Interactions panel logs them as calls of `screen`.
// A `screen` that queries `document.body` when it is called would replace this.
export function screenFollowsTheBody(): void {
  type Within = typeof within;
  const queriesOf = (within as Within & { __originalFn__?: Within }).__originalFn__ ?? within;
  const follow = () => {
    const { screen: queries } = instrument(
      { screen: queriesOf(document.body) },
      { intercept: (method) => method.startsWith('find') || method.startsWith('waitFor') }
    );
    Object.assign(screen, queries);
  };
  new MutationObserver(follow).observe(document.documentElement, { childList: true });
}

// A page story owns the document, so its play function looks in the page. A `canvasElement` that
// `renderToCanvas()` answers with would replace this.
export function canvasIsThePage(context: object): void {
  Object.assign(context, { canvasElement: document.body, canvas: within(document.body) });
}

// The tags whose stories a docs page leaves out, which `@storybook/addon-docs/preview` reads from
// this global for its `docs.stories.filter`. A filter that addon-docs exports would replace this.
export function tagsExcludedFromDocs(): Set<string> {
  const options = (globalThis as { TAGS_OPTIONS?: TagsOptions }).TAGS_OPTIONS;
  return new Set(
    Object.entries(options ?? {}).flatMap(([tag, option]) => (option.hideFromAutodocs ? [tag] : []))
  );
}
