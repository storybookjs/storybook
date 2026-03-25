import React, { type ReactElement } from 'react';

import { useId } from '@react-aria/utils';

/**
 * Provides a way to create an accessible description for an element. Returns a hidden element that
 * contains the description and attributes to pass to the described element.
 *
 * @param description The description to provide for the element.
 * @returns
 */
export function useAriaDescription(description = ''): {
  ariaDescriptionAttrs: {
    'aria-describedby'?: string;
  };
  AriaDescription: () => ReactElement | null;
} {
  const id = useId();
  const describedbyId = description ? `aria-description-${id}` : undefined;

  return {
    ariaDescriptionAttrs: {
      'aria-describedby': describedbyId,
    },
    AriaDescription: () =>
      describedbyId ? (
        <span id={describedbyId} hidden>
          {description}
        </span>
      ) : null,
  };
}
