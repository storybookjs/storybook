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

      // Make all potentially custom interactive elements inside the drawer focusable
      // if they don't already have a tabindex.
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
  }, [isActive]); // Removed 'onEscape' from deps as it's stable or should be memoized if not

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
        return; // Escape should work even if no other focusable elements
      }

      // If only Escape is relevant and no other focusable elements, exit early
      if (focusableElements.length === 0) return;

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

    // The 'focusout' listener on document can be problematic and overly aggressive.
    // Robust Tab/Shift+Tab handling within the container's keydown event is generally preferred.
    // If focus escaping is still an issue, this might be revisited, but test thoroughly.
    /*
    const handleFocusOut = (e: FocusEvent) => {
      if (container.contains(e.target as Node) && !container.contains(e.relatedTarget as Node)) {
        e.preventDefault();
        const elements = getFocusableElements(container);
        if (elements.length > 0) {
          elements[0].focus();
        } else {
          container.focus(); // Ensure container itself is focusable (e.g., tabIndex = -1)
        }
      }
    };
    document.addEventListener('focusout', handleFocusOut);
    */

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isActive, onEscape]); // onEscape dependency for keydown handler

  return containerRef;
}

// Helper function to get focusable elements
// Moved out of the hook for clarity, could also be memoized if container reference changes often (not typical for a trap)
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