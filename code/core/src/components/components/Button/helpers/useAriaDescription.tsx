import React from 'react';

/**
 * Provides a way to create an accessible description for an element. Returns a hidden element that
 * contains the description and attributes to pass to the described element.
 *
 * @param description The description to provide for the element.
 * @returns
 */
export function useAriaDescription(description?: string): {
  ariaDescriptionAttrs: {
    'aria-describedby'?: string;
  };
  AriaDescription: () => React.ReactElement | undefined;
} {
  const describedbyId = description?.toLowerCase().trim().replace(/\s+/g, '-');

  return {
    ariaDescriptionAttrs: {
      'aria-describedby': description ? describedbyId : undefined,
    },
    AriaDescription: () =>
      description ? (
        <span id={describedbyId} hidden>
          {description}
        </span>
      ) : undefined,
  };
}
