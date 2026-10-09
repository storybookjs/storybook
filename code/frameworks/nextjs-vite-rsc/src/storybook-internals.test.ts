// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';

import { rootFollowsTheBody } from './storybook-internals.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve));
const root = () => document.getElementById('storybook-root');

describe('rootFollowsTheBody', () => {
  let preview: HTMLElement;

  beforeAll(() => {
    document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
    preview = document.body;
    rootFollowsTheBody();
  });

  it('leaves the root of the preview alone', async () => {
    await tick();
    expect(document.querySelectorAll('#storybook-root')).toHaveLength(1);
    expect(root()?.parentElement).toBe(preview);
  });

  it('gives the body of a page an empty root after its content', async () => {
    const page = document.createElement('body');
    document.documentElement.replaceChild(page, preview);
    page.innerHTML = '<div>app</div><script>self.__next_f = []</script>';
    await tick();
    expect(root()?.parentElement).toBe(page);
    expect(page.lastElementChild).toBe(root());
    expect(root()?.hidden).toBe(true);
    expect(root()?.childNodes).toHaveLength(0);

    // Something that removes it, such as React rendering the document again
    root()?.remove();
    await tick();
    expect(page.lastElementChild).toBe(root());

    // The next page, after a navigation
    const next = document.createElement('body');
    next.innerHTML = '<main>next page</main>';
    document.documentElement.replaceChild(next, page);
    await tick();
    expect(next.lastElementChild).toBe(root());
    expect(document.querySelectorAll('#storybook-root')).toHaveLength(1);

    // The page is left: the preview has its own root back
    document.documentElement.replaceChild(preview, next);
    await tick();
    expect(document.querySelectorAll('#storybook-root')).toHaveLength(1);
    expect(root()?.parentElement).toBe(preview);
  });
});
