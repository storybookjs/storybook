import { link } from '@storybook/sveltekit/navigation.mock';

/*
 * SvelteKit's router turns link clicks into client-side navigations. Storybook has no router, so a
 * click would load another page in the preview. Instead, the click goes to the `link` spy.
 *
 * Clicks that open another window or download a file don't leave the preview, so the browser
 * handles them. Links to other origins, `data-sveltekit-reload` links and links that target the
 * parent or top window are intercepted too: they would replace the story, or Storybook itself.
 */
const sameWindowTargets = ['', '_self', '_parent', '_top'];

const onClick = (event: MouseEvent) => {
  // `defaultPrevented` also stops a second listener from reporting a click that one already did.
  // Like SvelteKit: other buttons and modifier keys open a new tab or window, or download
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const anchor = event
    .composedPath()
    // HTML and SVG links
    .find((element): element is Element => element instanceof Element && element.localName === 'a');
  const href = anchor?.getAttribute('href');
  if (!anchor || href === null || href === undefined) {
    return;
  }

  const target = anchor.getAttribute('target')?.toLowerCase() ?? '';
  if (!sameWindowTargets.includes(target) || anchor.hasAttribute('download')) {
    return;
  }

  event.preventDefault();
  link(href, event);
};

/*
 * Sends the link clicks of a story to the `link` spy. Returns a function that stops it.
 *
 * Each story has its own listener, so tearing down one story doesn't stop another. In docs mode,
 * several stories share the document with the docs page, so each handles only its own canvas, and
 * links in the docs page keep working. In story mode, it handles the whole document, so it also
 * covers links that a component renders outside its canvas, such as in a dialog.
 */
export function interceptLinkClicks({
  canvasElement,
  viewMode,
}: {
  // `null` when a portable story's `load()` runs `beforeEach` before it has a canvas
  canvasElement: HTMLElement | null;
  viewMode: string;
}) {
  const onStoryClick = (event: MouseEvent) => {
    if (viewMode === 'docs' && (!canvasElement || !event.composedPath().includes(canvasElement))) {
      return;
    }
    onClick(event);
  };
  const ownerDocument = canvasElement?.ownerDocument ?? globalThis.document;
  ownerDocument.addEventListener('click', onStoryClick);
  return () => ownerDocument.removeEventListener('click', onStoryClick);
}
