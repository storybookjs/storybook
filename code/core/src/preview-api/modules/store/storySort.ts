import type {
  Addon_StorySortComparatorV7,
  Addon_StorySortObjectParameter,
} from '@storybook/core/types';
import type { IndexEntry } from '@storybook/core/types';

const STORY_KIND_PATH_SEPARATOR = /\s*\/\s*/;

export const storySort =
  (options: Addon_StorySortObjectParameter = {}): Addon_StorySortComparatorV7 =>
  (a: IndexEntry, b: IndexEntry): number => {
    // If the two stories have the same story kind, then use the default
    // ordering, which is the order they are defined in the story file.
    // only when includeNames is falsy
    if (a.title === b.title && !options.includeNames) {
      return 0;
    }

    // Get the StorySortParameter options.
    const method = options.method || 'configure';
    let order = options.order || [];
    const weights = options.weights || {};

    // Examine each part of the story title in turn.
    const storyTitleA = a.title.trim().split(STORY_KIND_PATH_SEPARATOR);
    const storyTitleB = b.title.trim().split(STORY_KIND_PATH_SEPARATOR);
    if (options.includeNames) {
      storyTitleA.push(a.name);
      storyTitleB.push(b.name);
    }

    let depth = 0;
    while (storyTitleA[depth] || storyTitleB[depth]) {
      // Stories with a shorter depth should go first.
      if (!storyTitleA[depth]) {
        return -1;
      }
      if (!storyTitleB[depth]) {
        return 1;
      }

      // Compare the next part of the story title.
      const nameA = storyTitleA[depth];
      const nameB = storyTitleB[depth];
      if (nameA !== nameB) {
        let weightA = weights[nameA];
        let weightB = weights[nameB];

        // If at least one of the names has a weight, use it for sorting.
        if (weightA !== undefined || weightB !== undefined) {
          if (!weightA) {
            weightA = 0;
          }
          if (!weightB) {
            weightB = 0;
          }

          return weightA - weightB;
        }

        // Look for the names in the given `order` array.
        let indexA = order.indexOf(nameA);
        let indexB = order.indexOf(nameB);
        const indexWildcard = order.indexOf('*');

        // If at least one of the names is found, sort by the `order` array.
        if (indexA !== -1 || indexB !== -1) {
          // If one of the names is not found and there is a wildcard, insert it at the wildcard position.
          // Otherwise, list it last.
          if (indexA === -1) {
            if (indexWildcard !== -1) {
              indexA = indexWildcard;
            } else {
              indexA = order.length;
            }
          }
          if (indexB === -1) {
            if (indexWildcard !== -1) {
              indexB = indexWildcard;
            } else {
              indexB = order.length;
            }
          }

          return indexA - indexB;
        }

        // Use the default configure() order.
        if (method === 'configure') {
          return 0;
        }

        // Otherwise, use alphabetical order.
        return nameA.localeCompare(nameB, options.locales ? options.locales : undefined, {
          numeric: true,
          sensitivity: 'accent',
        });
      }

      // If a nested array is provided for a name, use it for ordering.
      let index = order.indexOf(nameA);
      if (index === -1) index = order.indexOf('*');
      order = index !== -1 && Array.isArray(order[index + 1]) ? order[index + 1] : [];

      // We'll need to look at the next part of the name.
      depth += 1;
    }

    // Identical story titles. The shortcut at the start of this function prevents
    // this from ever being used.
    /* istanbul ignore next */
    return 0;
  };
