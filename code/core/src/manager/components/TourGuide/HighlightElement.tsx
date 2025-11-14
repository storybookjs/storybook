import { useEffect } from 'react';

const HIGHLIGHT_KEYFRAMES_ID = 'storybook-highlight-element-keyframes';

const keyframes = `
  @keyframes sb-highlight-pulsate {
    0% {
      box-shadow: rgba(2,156,253,1) 0 0 2px 1px, 0 0 0 0 rgba(2, 156, 253, 0.7), 0 0 0 0 rgba(2, 156, 253, 0.4);
    }
    50% {
      box-shadow: rgba(2,156,253,1) 0 0 2px 1px, 0 0 0 20px rgba(2, 156, 253, 0), 0 0 0 40px rgba(2, 156, 253, 0);
    }
    100% {
      box-shadow: rgba(2,156,253,1) 0 0 2px 1px, 0 0 0 0 rgba(2, 156, 253, 0), 0 0 0 0 rgba(2, 156, 253, 0);
    }
  }
`;

const createOverlay = (element: HTMLElement) => {
  const overlay = document.createElement('div');
  overlay.id = 'storybook-highlight-element';
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.transition = 'opacity 0.2s ease-in-out';

  requestAnimationFrame(() => {
    updateOverlayStyles(element, overlay);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  return overlay;
};

const updateOverlayStyles = (element: HTMLElement, overlay: HTMLDivElement) => {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.borderRadius = computedStyle.borderRadius;
};

const findScrollableAncestors = (element: HTMLElement) => {
  const scrollableAncestors: Array<HTMLElement | Window> = [window];
  let parent = element.parentElement;

  while (parent) {
    const style = window.getComputedStyle(parent);
    const isScrollable =
      style.overflow === 'auto' ||
      style.overflow === 'scroll' ||
      style.overflowX === 'auto' ||
      style.overflowX === 'scroll' ||
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll';

    if (isScrollable) {
      scrollableAncestors.push(parent);
    }

    parent = parent.parentElement;
  }
  return scrollableAncestors;
};

export function HighlightElement({
  targetSelector,
  pulsating = false,
}: {
  targetSelector: string;
  pulsating?: boolean;
}): JSX.Element | null {
  useEffect(() => {
    const element = document.querySelector<HTMLElement>(targetSelector);
    if (!element || !element.parentElement) {
      return;
    }

    const overlay = document.body.appendChild(createOverlay(element));

    if (pulsating) {
      if (!document.getElementById(HIGHLIGHT_KEYFRAMES_ID)) {
        const style = document.createElement('style');
        style.id = HIGHLIGHT_KEYFRAMES_ID;
        style.innerHTML = keyframes;
        document.head.appendChild(style);
      }

      overlay.style.animation = 'sb-highlight-pulsate 3s infinite';
      overlay.style.transformOrigin = 'center';
      overlay.style.animationTimingFunction = 'ease-in-out';
    } else {
      overlay.style.boxShadow = 'rgba(2,156,253,1) 0 0 2px 1px';
    }

    let scrollTimeout: number | null = null;
    const handleScroll = () => {
      if (overlay.parentElement) {
        overlay.remove();
      }

      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = window.setTimeout(() => {
        if (!element) {
          return;
        }

        updateOverlayStyles(element, overlay);
        overlay.style.opacity = '0';
        document.body.appendChild(overlay);
        requestAnimationFrame(() => (overlay.style.opacity = '1'));
      }, 150);
    };

    const resizeObserver = new ResizeObserver(
      () => overlay.parentElement && updateOverlayStyles(element, overlay)
    );
    resizeObserver.observe(window.document.body);
    resizeObserver.observe(element);

    const scrollContainers = findScrollableAncestors(element);
    scrollContainers.forEach((el) =>
      el.addEventListener('scroll', handleScroll, { passive: true })
    );
    scrollContainers
      .filter((el): el is HTMLElement => el !== window)
      .forEach((el) => resizeObserver.observe(el));

    return () => {
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }

      if (overlay.parentElement) {
        overlay.remove();
      }

      scrollContainers.forEach((el) => el.removeEventListener('scroll', handleScroll));
      resizeObserver.disconnect();
    };
  }, [targetSelector, pulsating]);

  return null;
}
