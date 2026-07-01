import { global } from '@storybook/global';

import {
  IFRAME_RESIZE_CONTEXT,
  IFRAME_RESIZE_REQUEST_CONTEXT,
} from '../../../shared/constants/iframe-resize.ts';

import { shouldEmbed } from './embedMode.ts';
import { shouldFreeze } from './setupStoryFreezer.ts';

const EMBED_STYLE_ID = 'storybook-embed-sizing';
const EMBED_UI_STYLE_ID = 'storybook-embed-ui';

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

const REPLACED_OR_CONTROL_TAGS = new Set([
  'button',
  'canvas',
  'embed',
  'iframe',
  'img',
  'input',
  'object',
  'select',
  'svg',
  'textarea',
  'video',
]);

const BLOCK_LEVEL_TAGS = [
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'dialog',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
] as const;

const descendantSelector = `* ${Array.from(IGNORE_TAGS)
  .map((tag) => `:not(${tag})`)
  .join('')}`;

const isTransparentColor = (color: string): boolean => {
  if (!color || color === 'transparent') {
    return true;
  }

  const match = color.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (match) {
    const alpha = match[1] !== undefined ? parseFloat(match[1]) : 1;
    return alpha === 0;
  }

  return false;
};

const hasVisibleDecoration = (style: CSSStyleDeclaration): boolean => {
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    return true;
  }
  if (!isTransparentColor(style.backgroundColor)) {
    return true;
  }

  for (const property of [
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
  ] as const) {
    if (parseFloat(style[property]) > 0) {
      return true;
    }
  }

  for (const property of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
    if (parseFloat(style[property]) > 0) {
      return true;
    }
  }

  if (style.boxShadow && style.boxShadow !== 'none') {
    return true;
  }

  return parseFloat(style.outlineWidth) > 0;
};

const isReplacedOrControl = (element: Element): boolean => {
  return REPLACED_OR_CONTROL_TAGS.has(element.tagName.toLowerCase());
};

const hasDirectText = (element: Element): boolean => {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }

  return false;
};

const isStretchedToParent = (element: Element): boolean => {
  const parent = element.parentElement;
  if (!parent) {
    return false;
  }

  const elementRect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();

  return elementRect.width > 0 && Math.abs(elementRect.width - parentRect.width) < 1;
};

const hasExplicitWidth = (style: CSSStyleDeclaration): boolean => {
  const { width } = style;
  if (!width || width === 'auto') {
    return false;
  }

  return width !== 'fit-content' && width !== 'max-content' && width !== 'min-content';
};

const coversViewport = (element: Element): boolean => {
  const rect = element.getBoundingClientRect();

  return (
    rect.width >= window.innerWidth - 1 &&
    rect.height >= window.innerHeight - 1 &&
    rect.top <= 1 &&
    rect.left <= 1
  );
};

/**
 * Full-viewport fixed underlays (e.g. Select/Popover dismiss layers) are tracked on
 * `document.body` but should not inflate embed thumbnail dimensions.
 */
export const isViewportOverlayUnderlay = (element: Element): boolean => {
  const style = window.getComputedStyle(element);

  if (style.position !== 'fixed' && style.position !== 'absolute') {
    return false;
  }

  if (hasVisibleDecoration(style) || isReplacedOrControl(element) || hasDirectText(element)) {
    return false;
  }

  return coversViewport(element);
};

/**
 * Layout-only wrappers that stretch to their parent without painting anything visible.
 * Their descendants carry the intrinsic size we want for embed thumbnails.
 */
export const isPassThroughContainer = (element: Element): boolean => {
  const style = window.getComputedStyle(element);

  if (style.display === 'contents') {
    return true;
  }

  if (hasVisibleDecoration(style) || isReplacedOrControl(element) || hasDirectText(element)) {
    return false;
  }

  if (hasExplicitWidth(style)) {
    return false;
  }

  return isStretchedToParent(element);
};

const shouldExcludeFromMeasurement = (element: Element): boolean => {
  return isPassThroughContainer(element) || isViewportOverlayUnderlay(element);
};

const getMeasurableElements = (elements: Iterable<Element>): Element[] => {
  const all = [...elements];
  const measurable = all.filter((element) => !shouldExcludeFromMeasurement(element));

  return measurable.length > 0 ? measurable : all;
};

const getBodyPadding = (
  documentRef: Document
): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} => {
  const style = window.getComputedStyle(documentRef.body);
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
};

const getDimensions = (
  elements: Iterable<Element>,
  documentRef: Document
): { width: number; height: number } => {
  let minTop = Infinity;
  let minLeft = Infinity;
  let maxBottom = 0;
  let maxRight = 0;

  for (const element of getMeasurableElements(elements)) {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const marginTop = parseFloat(computedStyle.marginTop) || 0;
    const marginLeft = parseFloat(computedStyle.marginLeft) || 0;
    const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
    const marginRight = parseFloat(computedStyle.marginRight) || 0;

    minTop = Math.min(minTop, rect.top - marginTop);
    minLeft = Math.min(minLeft, rect.left - marginLeft);
    maxBottom = Math.max(maxBottom, rect.bottom + marginBottom);
    maxRight = Math.max(maxRight, rect.right + marginRight);
  }

  const padding = getBodyPadding(documentRef);
  const contentWidth = maxRight - minLeft;
  const contentHeight = maxBottom - minTop;

  return {
    width: Math.ceil(contentWidth + padding.left + padding.right),
    height: Math.ceil(contentHeight + padding.top + padding.bottom),
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

const injectEmbedSizingStyles = (documentRef: Document): void => {
  if (documentRef.getElementById(EMBED_STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement('style');
  style.id = EMBED_STYLE_ID;
  // `:where` is used so the selector has a specificity of 0, allowing overrides
  style.textContent = `${`:where(#storybook-root > :is(${BLOCK_LEVEL_TAGS.join(', ')}))`} {
    width: fit-content;
    max-width: 100%;
  }`;
  documentRef.head.appendChild(style);
};

const removeEmbedSizingStyles = (documentRef: Document): void => {
  documentRef.getElementById(EMBED_STYLE_ID)?.remove();
};

/** Review thumbnails draw their own loader outside the scale wrapper. */
const injectEmbedUiStyles = (documentRef: Document): void => {
  if (documentRef.getElementById(EMBED_UI_STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement('style');
  style.id = EMBED_UI_STYLE_ID;
  style.textContent = `
    .sb-preparing-story,
    .sb-preparing-docs {
      display: none !important;
    }
  `;
  documentRef.head.appendChild(style);
};

let lastDimensions: { width: number; height: number } | null = null;

const sendResizeMessage = (
  elements: Set<Element>,
  windowRef: Window,
  documentRef: Document
): void => {
  if (!elements.size) {
    return;
  }

  injectEmbedSizingStyles(documentRef);
  const dimensions = getDimensions(elements, documentRef);
  removeEmbedSizingStyles(documentRef);

  if (dimensions.width === lastDimensions?.width && dimensions.height === lastDimensions?.height) {
    return;
  }

  const message = JSON.stringify({
    src: windowRef.location.toString(),
    context: IFRAME_RESIZE_CONTEXT,
    width: dimensions.width,
    height: dimensions.height,
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
  /** Tear down listeners/observers; for tests and hot reload. */
  cleanup?: () => void;
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

  lastDimensions = null;

  const freezing = shouldFreeze({ search: documentRef.location.search });

  if (freezing) {
    // Review thumbnails draw their own loader in the manager grid.
    injectEmbedUiStyles(documentRef);
  }
  let contentFrozen = false;

  const measureAndSend = () => {
    const elements = getTrackedElements();
    sendResizeMessage(elements, windowRef, documentRef);
  };

  const onParentMessage = (event: MessageEvent) => {
    if (event.source !== windowRef.parent) {
      return;
    }
    try {
      const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (parsed?.context === IFRAME_RESIZE_REQUEST_CONTEXT) {
        if (freezing && !contentFrozen) {
          return;
        }
        lastDimensions = null;
        measureAndSend();
      }
    } catch {
      // Ignore malformed parent messages.
    }
  };
  windowRef.addEventListener('message', onParentMessage);
  const cleanups: Array<() => void> = [
    () => windowRef.removeEventListener('message', onParentMessage),
  ];

  if (freezing) {
    // Thumbnail embeds use freeze=finished so the preview can settle before measuring.
    // Measuring earlier (e.g. while a portaled dismiss underlay is mounted) would
    // report the iframe viewport instead of the story chrome.
    return {
      onContentFrozen: () => {
        contentFrozen = true;
        measureAndSend();
      },
      cleanup: () => cleanups.forEach((fn) => fn()),
    };
  }

  const trackedElements = getTrackedElements();
  const update = () => sendResizeMessage(trackedElements, windowRef, documentRef);
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
  cleanups.push(
    () => resizeObserver.disconnect(),
    () => mutationObserver.disconnect(),
    () => windowRef.removeEventListener('resize', debouncedUpdate)
  );

  measureAndSend();

  return { cleanup: () => cleanups.forEach((fn) => fn()) };
};
