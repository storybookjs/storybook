import { useEffect, useRef } from 'react';

import { useTheme } from 'storybook/theming';

import { useMediaQuery } from '../../hooks/useMedia';

function findActiveLandmarkElement() {
  let currentElement: Element | null = document.activeElement;
  let landmarkElement: HTMLElement | null = null;

  while (currentElement) {
    if (currentElement instanceof HTMLElement && currentElement.hasAttribute('data-sb-landmark')) {
      landmarkElement = currentElement;
      break;
    }
    currentElement = currentElement.parentElement;
  }

  return landmarkElement;
}

// Global keyboard handler for F6/Shift+F6 landmark navigation that
// highlights the landmark containing the current element. This helps
// users who navigate through landmark shortcuts more quickly visualise
// which region of the UI they landed into.
export function useLandmarkIndicator() {
  const theme = useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const currentAnimationRef = useRef<Animation | null>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F6') {
        return;
      }

      const landmarkElement = findActiveLandmarkElement();
      if (!landmarkElement) {
        return;
      }

      // Cancel previous landmark animation if user switches fast.
      if (currentAnimationRef.current) {
        currentAnimationRef.current.cancel();
        currentAnimationRef.current = null;
      }

      if (!reducedMotion) {
        const animation = landmarkElement.animate(
          [{ border: `2px solid ${theme.color.primary}` }, { border: `2px solid transparent` }],
          {
            duration: 1500,
            pseudoElement: '::after',
          }
        );
        currentAnimationRef.current = animation;

        animation.onfinish = () => {
          currentAnimationRef.current = null;
        };
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [reducedMotion, theme.color.primary]);
}
