import { useEffect, useRef } from 'react';

import { useTheme } from 'storybook/theming';

import { useMediaQuery } from '../../hooks/useMedia.tsx';

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

// Highlights the landmark that focus lands in during landmark navigation, so users who move
// between regions with the keyboard can see which region of the UI they landed into. Covers
// F6/Shift+F6 (handled by react-aria) and any other path that focuses a landmark element itself,
// such as the focus-region keyboard shortcuts.
// Call this once at the app root.
export function useLandmarkIndicator() {
  const animateLandmark = useRegionFocusAnimation();

  useEffect(() => {
    // react-aria restores focus to the last focused element inside a landmark when revisiting
    // it, so the keydown is what identifies landmark navigation in that case.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F6') {
        return;
      }

      const landmarkElement = findActiveLandmarkElement();
      if (!landmarkElement) {
        return;
      }

      animateLandmark(landmarkElement);
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.hasAttribute('data-sb-landmark')) {
        animateLandmark(e.target);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [animateLandmark]);
}
