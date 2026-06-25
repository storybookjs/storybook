import { global } from '@storybook/global';

import { shouldFreeze } from './setupStoryFreezer.ts';

export const IFRAME_RESIZE_CONTEXT = 'iframe.resize';

/**
 * These elements do not have any visual dimensions and therefore can be ignored.
 */
const IGNORE_TAGS = new Set([
  'area',
  'base',
  'body',
  'head',
  'link',
  'map',
  'meta',
  'nobr',
  'optgroup',
  'option',
  'script',
  'style',
  'template',
  'title',
  'track',
  'wbr',
]);

const descendantSelector = `* ${Array.from(IGNORE_TAGS)
  .map((tag) => `:not(${tag})`)
  .join('')}`;

export const shouldEmbed = ({ search }: { search: string }) => {
  return new URLSearchParams(search).get('embed') === 'true';
};

const getDimensions = (elements: Iterable<Element>): { width: number; height: number } => {
  let maxBottom = 0;
  let maxRight = 0;

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
    const marginRight = parseFloat(computedStyle.marginRight) || 0;
    const bottom = rect.bottom + marginBottom;
    const right = rect.right + marginRight;

    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
    if (right > maxRight) {
      maxRight = right;
    }
  }

  return {
    width: Math.ceil(maxRight),
    height: Math.ceil(maxBottom),
  };
};

const getBodyPadding = (): { top: number; bottom: number; left: number; right: number } => {
  const style = window.getComputedStyle(document.body);
  return {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  };
};

const getTrackedElements = (): Set<Element> => {
  const elements = new Set<Element>();

  const nodes = [
    ...Array.from(document.getElementById('storybook-root')?.children || []),
    ...Array.from(document.body.children).filter((child) => !child.id.startsWith('storybook-')),
  ];
  for (const node of nodes) {
    if (node instanceof Element && !IGNORE_TAGS.has(node.tagName.toLowerCase())) {
      elements.add(node);
      for (const descendant of Array.from(node.querySelectorAll(descendantSelector))) {
        elements.add(descendant);
      }
    }
  }

  return elements;
};

let lastDimensions: { width: number; height: number } | null = null;

const sendResizeMessage = (elements: Set<Element>, windowRef: Window): void => {
  if (!elements.size) {
    return;
  }

  const dimensions = getDimensions(elements);
  if (dimensions.width === lastDimensions?.width && dimensions.height === lastDimensions?.height) {
    return;
  }

  const padding = getBodyPadding();
  const message = JSON.stringify({
    src: windowRef.location.toString(),
    context: IFRAME_RESIZE_CONTEXT,
    width: dimensions.width + padding.left + padding.right,
    height: dimensions.height + padding.top + padding.bottom,
  });
  lastDimensions = dimensions;

  try {
    if (windowRef.parent !== windowRef) {
      windowRef.parent.postMessage(message, '*');
    }
  } catch {
    // Silently ignore CORS errors — the parent frame is out of our control.
  }
};

const debounce = (callback: () => void): (() => void) => {
  let rafId: number | null = null;

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      callback();
      rafId = null;
    });
  };
};

export type ContentResizeBroadcast = {
  /** Final measure after freeze; only set when freeze is also active. */
  onContentFrozen?: () => void;
};

/**
 * When `embed=true`, measure story content and notify the parent frame via
 * postMessage so embedded thumbnails can size themselves to the content.
 */
export const setupContentResizeBroadcast = (): ContentResizeBroadcast => {
  const windowRef = global.window;
  const documentRef = global.document;
  if (!windowRef || !documentRef) {
    return {};
  }

  if (!shouldEmbed({ search: documentRef.location.search })) {
    return {};
  }

  const trackedElements = getTrackedElements();
  const update = () => sendResizeMessage(trackedElements, windowRef);
  const debouncedUpdate = debounce(update);

  const resizeObserver = new ResizeObserver(debouncedUpdate);
  for (const element of trackedElements) {
    resizeObserver.observe(element);
  }

  const mutationObserver = new MutationObserver(() => {
    debouncedUpdate();

    const updatedElements = getTrackedElements();
    for (const element of updatedElements) {
      if (!trackedElements.has(element)) {
        resizeObserver.observe(element);
        trackedElements.add(element);
      }
    }
    for (const element of trackedElements) {
      if (!updatedElements.has(element)) {
        resizeObserver.unobserve(element);
        trackedElements.delete(element);
      }
    }
  });
  mutationObserver.observe(documentRef.body, {
    childList: true,
    subtree: true,
  });

  windowRef.addEventListener('resize', debouncedUpdate);

  const stop = () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    windowRef.removeEventListener('resize', debouncedUpdate);
  };

  const freezing = shouldFreeze({ search: documentRef.location.search });

  return {
    onContentFrozen: freezing
      ? () => {
          update();
          stop();
        }
      : undefined,
  };
};
