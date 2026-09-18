import { logger } from 'storybook/internal/client-logger';

/**
 * When multiple iframes match the event origin (e.g. composed refs from the same origin),
 * disambiguate by refId: the preview includes refId in the URL, so we pick the iframe whose src
 * contains that refId. If there is only one candidate, return it.
 */
const pickFrameByRefId = (
  candidates: HTMLIFrameElement[],
  refId: string | undefined
): HTMLIFrameElement | undefined => {
  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length === 0 || !refId) {
    return undefined;
  }
  return candidates.find((el) =>
    (el.getAttribute('src') ?? '').includes(`refId=${encodeURIComponent(refId)}`)
  );
};

export const getEventSourceUrl = (event: MessageEvent, refId?: string): string | null => {
  const frames: HTMLIFrameElement[] = Array.from(
    document.querySelectorAll('iframe[data-is-storybook]')
  );
  // try to find the originating iframe by matching it's contentWindow
  // This might not be cross-origin safe
  const candidates = frames.filter((element) => {
    try {
      return (
        element.contentWindow?.location.origin === (event.source as Window).location.origin &&
        element.contentWindow?.location.pathname === (event.source as Window).location.pathname
      );
    } catch {
      // continue
    }
    try {
      return element.contentWindow === event.source;
    } catch {
      // continue
    }

    const src = element.getAttribute('src');
    let origin;

    try {
      if (!src) {
        return false;
      }

      ({ origin } = new URL(src, document.location.toString()));
    } catch {
      return false;
    }
    return origin === event.origin;
  });

  const src = pickFrameByRefId(candidates, refId)?.getAttribute('src');

  if (src) {
    const { protocol, host, pathname } = new URL(src, document.location.toString());
    return `${protocol}//${host}${pathname}`;
  }

  if (candidates.length > 1) {
    // Multiple matches and we couldn't disambiguate (e.g. no refId in message)
    logger.error('found multiple candidates for event source');
  }

  return null;
};
