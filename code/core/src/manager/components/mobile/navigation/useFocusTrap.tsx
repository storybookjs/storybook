import { useEffect, useRef } from 'react';

/**
 * Hook to trap focus within a container when active
 *
 * @param isActive Whether the focus trap should be active
 * @param onEscape Optional callback to run when Escape key is pressed
 * @returns A ref to attach to the container element
 */
export function useFocusTrap(isActive: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Store the active element when the trap becomes active and focus the container/first element
  useEffect(() => {
    const container = containerRef.current;
    if (isActive && container) {
      if (document.activeElement instanceof HTMLElement) {
        previousActiveElementRef.current = document.activeElement;
      }

      const interactiveRoleElements = container.querySelectorAll<HTMLElement>(
        'div[role="button"], span[role="button"], [role="link"]'
      );
      interactiveRoleElements.forEach((element) => {
        if (!element.hasAttribute('tabindex')) {
          element.setAttribute('tabindex', '0');
        }
      });

      const focusableElements = getFocusableElements(container);

      requestAnimationFrame(() => {
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          // Make the container itself focusable if not already and no interactive elements
          if (container.getAttribute('tabindex') === null || container.tabIndex < 0) {
            container.setAttribute('tabindex', '-1'); // Or '0' if you want it in tab order when empty
          }
          container.focus();
        }
      });
    } else if (!isActive && previousActiveElementRef.current) {
      // Return focus to the element that was focused before the trap was activated
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null; // Clear ref after returning focus
    }
  }, [isActive]);

  // Set up the keyboard event listeners for the focus trap
  useEffect(() => {
    const container = containerRef.current;

    if (!isActive || !container) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const focusableElements = getFocusableElements(container);

      if (focusableElements.length === 0 && e.key !== 'Escape') {
        // If no focusable elements, only allow Escape to function
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, onEscape]);

  return containerRef;
}

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), details:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), [contenteditable="true"]:not([disabled])'
    )
  ).filter(
    (el) =>
      el.getAttribute('aria-hidden') !== 'true' &&
      window.getComputedStyle(el).display !== 'none' &&
      window.getComputedStyle(el).visibility !== 'hidden'
  );
};
