import { logger } from '@storybook/core/client-logger';

export const getEventSourceUrl = (event: MessageEvent) => {
  const frames: HTMLIFrameElement[] = Array.from(
    document.querySelectorAll('iframe[data-is-storybook]')
  );
  // try to find the originating iframe by matching it's contentWindow
  // This might not be cross-origin safe
  const [frame, ...remainder] = frames.filter((element) => {
    try {
      return (
        element.contentWindow?.location.origin === (event.source as Window).location.origin &&
        element.contentWindow?.location.pathname === (event.source as Window).location.pathname
      );
    } catch (err) {
      // continue
    }
    try {
      return element.contentWindow === event.source;
    } catch (err) {
      // continue
    }

    const src = element.getAttribute('src');
    let origin;

    try {
      if (!src) {
        return false;
      }

      ({ origin } = new URL(src, document.location.toString()));
    } catch (err) {
      return false;
    }
    return origin === event.origin;
  });

  const src = frame?.getAttribute('src');
  if (src && remainder.length === 0) {
    const { protocol, host, pathname } = new URL(src, document.location.toString());
    return `${protocol}//${host}${pathname}`;
  }

  if (remainder.length > 0) {
    // If we found multiple matches, there's going to be trouble
    logger.error('found multiple candidates for event source');
  }

  // If we found no frames of matches
  return null;
};
