import { useEffect } from 'react';

export function HighlightElement({
  targetSelector,
  pulsating = false,
}: {
  targetSelector: string;
  pulsating?: boolean;
}): JSX.Element | null {
  useEffect(() => {
    const element = document.querySelector<HTMLElement>(targetSelector);

    if (element) {
      if (pulsating) {
        element.style.animation = 'pulsate 3s infinite';
        element.style.transformOrigin = 'center';
        element.style.animationTimingFunction = 'ease-in-out';

        const keyframes = `
        @keyframes pulsate {
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
        const style = document.createElement('style');
        style.id = 'sb-onboarding-pulsating-effect';
        style.innerHTML = keyframes;
        document.head.appendChild(style);
      } else {
        element.style.boxShadow = 'rgba(2,156,253,1) 0 0 2px 1px';
      }
    }

    return () => {
      const styleElement = document.querySelector('#sb-onboarding-pulsating-effect');

      if (styleElement) {
        styleElement.remove();
      }

      if (element) {
        element.style.animation = '';
        element.style.boxShadow = '';
      }
    };
  }, [targetSelector, pulsating]);

  return null;
}
