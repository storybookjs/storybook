import type {
  Addon_StorySortComparatorV7,
  Addon_StorySortObjectParameter,
  Addon_StorySortOrder,
} from 'storybook/internal/types';
import type { IndexEntry } from 'storybook/internal/types';

const STORY_KIND_PATH_SEPARATOR = /\s*\/\s*/;

// The `order` array outranks any method: look the two names up in the current
// order list and return their relative positions, or undefined when the list
// decides nothing for this pair.
const compareByOrder = (
  order: Addon_StorySortOrder,
  nameA: string,
  nameB: string
): number | undefined => {
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
const nextOrderList = (order: Addon_StorySortOrder, name: string): Addon_StorySortOrder => {
  let index = order.indexOf(name);
  if (index === -1) {
    index = order.indexOf('*');
  }
  const next = order[index + 1];
  return index !== -1 && Array.isArray(next) ? next : [];
};

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
    // 'alphabetical-by-kind': at every level of the title tree, folders sort
    // before files, which sort before story names.
    const groupsFirst = method === 'alphabetical-by-kind';
    let order = options.order || [];

    // Examine each part of the story title in turn.
    const storyTitleA = a.title.trim().split(STORY_KIND_PATH_SEPARATOR);
    const storyTitleB = b.title.trim().split(STORY_KIND_PATH_SEPARATOR);
    const lastTitleDepthA = storyTitleA.length - 1;
    const lastTitleDepthB = storyTitleB.length - 1;
    if (options.includeNames) {
      storyTitleA.push(a.name);
      storyTitleB.push(b.name);
    }

    let depth = 0;
    while (storyTitleA[depth] || storyTitleB[depth]) {
      // Grouping folders first puts a continuing title ('a / b') before one that
      // ends here ('a'). This runs before `order` so an appended story name is
      // never weighed against a title segment: names compare only once both
      // titles have ended.
      if (groupsFirst) {
        const titleEndedA = depth > lastTitleDepthA;
        const titleEndedB = depth > lastTitleDepthB;
        if (titleEndedA !== titleEndedB) {
          return titleEndedA ? 1 : -1;
        }
      }

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

        // Rank the segment by its position in its own entry: folder (-1), the
        // title's last segment (0), or an appended story name (1). Names only
        // meet names here, since the title-ended check above already decided.
        if (groupsFirst) {
          const byRank = Math.sign(depth - lastTitleDepthA) - Math.sign(depth - lastTitleDepthB);
          if (byRank !== 0) {
            return byRank;
          }
        } else if (method === 'configure') {
          // Use the default configure() order.
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
