import { useEffect, useRef } from 'react';

import { useTheme } from 'storybook/theming/emotion';

import { useMediaQuery } from '../../hooks/useMedia.tsx';

function findLandmarkElement(element: EventTarget | null) {
  let currentElement = element instanceof Element ? element : null;
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

export function useRegionFocusAnimation() {
  const theme = useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const currentAnimationRef = useRef<Animation | null>(null);

  const animateLandmark = (elementToAnimate: HTMLElement | null) => {
    if (!elementToAnimate) {
      return;
    }

    // Cancel previous landmark animation if user switches fast.
    if (currentAnimationRef.current) {
      currentAnimationRef.current.cancel();
      currentAnimationRef.current = null;
    }

    if (!reducedMotion) {
      const animation = elementToAnimate.animate(
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

  return animateLandmark;
}

// Highlights the landmark that F6/Shift+F6 landmark navigation lands in, so users who move
// between regions with the keyboard can see which region of the UI they landed into.
// Call this once at the app root.
export function useLandmarkIndicator() {
  const animateLandmark = useRegionFocusAnimation();

  useEffect(() => {
    // React Aria moves focus in a React effect after the keydown, so the landmark to highlight is
    // only known once focus has landed: the keydown arms the indicator, and the focus change that
    // follows fires it. A key that moves no focus leaves it to expire.
    let armedUntil = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        armedUntil = Date.now() + 250;
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (Date.now() > armedUntil) {
        return;
      }
      armedUntil = 0;

      const landmarkElement = findLandmarkElement(e.target);
      if (landmarkElement) {
        animateLandmark(landmarkElement);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('focusin', handleFocusIn, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('focusin', handleFocusIn, { capture: true });
    };
  }, [animateLandmark]);
}
