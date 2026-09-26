import type {
  Addon_StorySortComparatorV7,
  Addon_StorySortObjectParameter,
} from 'storybook/internal/types';
import type { IndexEntry } from 'storybook/internal/types';

const STORY_KIND_PATH_SEPARATOR = /\s*\/\s*/;

// The `order` array outranks any method: look the two names up in the current
// order list and return their relative positions, or undefined when the list
// decides nothing for this pair.
const compareByOrder = (order: unknown[], nameA: string, nameB: string): number | undefined => {
  let indexA = order.indexOf(nameA);
  let indexB = order.indexOf(nameB);
  if (indexA === -1 && indexB === -1) {
    return undefined;
  }

  // If one of the names is not found and there is a wildcard, insert it at the wildcard position.
  // Otherwise, list it last.
  const indexWildcard = order.indexOf('*');
  if (indexA === -1) {
    indexA = indexWildcard !== -1 ? indexWildcard : order.length;
  }
  if (indexB === -1) {
    indexB = indexWildcard !== -1 ? indexWildcard : order.length;
  }

  return indexA - indexB;
};

// If a nested array is provided for a name, use it for ordering.
const nextOrderList = (order: unknown[], name: string): unknown[] => {
  let index = order.indexOf(name);
  if (index === -1) {
    index = order.indexOf('*');
  }
  const next = order[index + 1];
  return index !== -1 && Array.isArray(next) ? next : [];
};

const configureOrAlphabeticalSort =
  (options: Addon_StorySortObjectParameter): Addon_StorySortComparatorV7 =>
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
        const byOrder = compareByOrder(order, nameA, nameB);
        if (byOrder !== undefined) {
          return byOrder;
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

      order = nextOrderList(order, nameA);

      // We'll need to look at the next part of the name.
      depth += 1;
    }

    // Identical story titles. The shortcut at the start of this function prevents
    // this from ever being used.
    /* istanbul ignore next */
    return 0;
  };

// 'alphabetical-by-kind': at every level of the title tree, folders sort before
// files and each class sorts alphabetically. Folder-ness comes from the entry's
// own title — a segment with further segments after it is a folder position.
const alphabeticalByKindSort = (
  options: Addon_StorySortObjectParameter
): Addon_StorySortComparatorV7 => {
  // Pre-split each title once per sort instead of once per comparison.
  const segmentsByTitle = new Map<string, string[]>();
  const titleSegments = (title: string): string[] => {
    let segments = segmentsByTitle.get(title);
    if (segments === undefined) {
      // Skip empty segments like the tree builder does; a trailing slash is
      // rejected at render time but can still reach the comparator.
      segments = title.trim().split(STORY_KIND_PATH_SEPARATOR).filter(Boolean);
      segmentsByTitle.set(title, segments);
    }
    return segments;
  };

  return (a: IndexEntry, b: IndexEntry): number => {
    if (a.title === b.title && !options.includeNames) {
      return 0;
    }

    let order = options.order || [];
    const storyTitleA = titleSegments(a.title);
    const storyTitleB = titleSegments(b.title);

    let depth = 0;
    while (storyTitleA[depth] || storyTitleB[depth]) {
      // A title ending here holds a file position at the shared segment while
      // the continuing title holds a folder position there, so the continuing
      // title sorts first — 'a / b' precedes 'a'.
      if (!storyTitleA[depth]) {
        return 1;
      }
      if (!storyTitleB[depth]) {
        return -1;
      }

      // Compare the next part of the story title.
      const nameA = storyTitleA[depth];
      const nameB = storyTitleB[depth];
      if (nameA !== nameB) {
        const byOrder = compareByOrder(order, nameA, nameB);
        if (byOrder !== undefined) {
          return byOrder;
        }

        // At the first divergence, a folder segment beats a file segment.
        const folderA = depth < storyTitleA.length - 1;
        const folderB = depth < storyTitleB.length - 1;
        if (folderA !== folderB) {
          return folderA ? -1 : 1;
        }

        return nameA.localeCompare(nameB, options.locales ? options.locales : undefined, {
          numeric: true,
          sensitivity: 'accent',
        });
      }

      order = nextOrderList(order, nameA);
      depth += 1;
    }

    // Titles fully match: story names are file positions and compare only now
    // that both entries reached this depth. Without includeNames, the shortcut
    // at the top already handled equal titles.
    if (options.includeNames) {
      const byOrder = compareByOrder(order, a.name, b.name);
      if (byOrder !== undefined) {
        return byOrder;
      }
      return a.name.localeCompare(b.name, options.locales ? options.locales : undefined, {
        numeric: true,
        sensitivity: 'accent',
      });
    }

    return 0;
  };
};

export const storySort = (
  options: Addon_StorySortObjectParameter = {}
): Addon_StorySortComparatorV7 =>
  options.method === 'alphabetical-by-kind'
    ? alphabeticalByKindSort(options)
    : configureOrAlphabeticalSort(options);
