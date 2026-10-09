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

// Chromatic captures a story in a document that has Storybook's root, `#storybook-root`, and fails
// with "Missing root element on page" without one. It captures what is in the `<body>`, with the
// content of the root in place of the root. A page of the app gets a `<body>` of its own, also when
// a story navigates to one, so that body gets an empty root at its end: the snapshot is the page.
// React leaves alone what follows the app in `<body>` when it hydrates it. It is added again when
// something removes it, and the body of the preview has the root of its own back once the page is
// left. A root element that `renderToCanvas()` could name, which Chromatic reads, would replace this.
export function rootFollowsTheBody(): void {
  let body: HTMLElement | undefined;
  const follow = () => {
    if (!document.getElementById('storybook-root')) {
      const root = document.createElement('div');
      root.id = 'storybook-root';
      root.hidden = true;
      document.body.append(root);
    }
    if (document.body !== body) {
      body = document.body;
      observer.observe(body, { childList: true });
    }
  };
  const observer = new MutationObserver(follow);
  observer.observe(document.documentElement, { childList: true });
  follow();
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
