import type { SyntheticEvent } from 'react';

import { global } from '@storybook/global';

import memoize from 'memoizerific';
import type {
  ComponentEntry,
  GroupEntry,
  HashEntry,
  IndexHash,
  StoryEntry,
} from 'storybook/manager-api';

import { DEFAULT_REF_ID } from '../components/sidebar/Sidebar.tsx';
import type { Dataset, Item, RefType, SearchItem } from '../components/sidebar/types.ts';

const { document, window: globalWindow } = global;

export const createId = (itemId: string, refId?: string) =>
  !refId || refId === DEFAULT_REF_ID ? itemId : `${refId}_${itemId}`;

export const getLink = (item: HashEntry, refId?: string) => {
  return `${document.location.pathname}?path=/${item.type}/${createId(item.id, refId)}`;
};

export const prevent = (e: SyntheticEvent) => {
  e.preventDefault();
  return false;
};

export const get = memoize(1000)((id: string, dataset: Dataset) => dataset[id]);
export const getParent = memoize(1000)((id: string, dataset: Dataset) => {
  const item = get(id, dataset);
  return item && item.type !== 'root' ? get(item.parent as string, dataset) : undefined;
});
export const getParents = memoize(1000)((id: string, dataset: Dataset): Item[] => {
  const parent = getParent(id, dataset);
  return parent ? [parent, ...getParents(parent.id, dataset)] : [];
});
export const getAncestorIds = memoize(1000)((data: IndexHash, id: string): string[] =>
  getParents(id, data).map((item) => item.id)
);
export const getDescendantIds = memoize(1000)((
  data: IndexHash,
  id: string,
  skipLeafs: boolean
): string[] => {
  const entry = data[id];
  if (!entry || !('children' in entry) || !entry.children) {
    return [];
  }
  return entry.children.reduce((acc, childId) => {
    const child = data[childId];

    if (!child || (skipLeafs && (child.type === 'story' || child.type === 'docs'))) {
      return acc;
    }
    acc.push(childId, ...getDescendantIds(data, childId, skipLeafs));
    return acc;
  }, [] as string[]);
});

export function getPath(item: Item, ref: Pick<RefType, 'id' | 'title' | 'index'>): string[] {
  // @ts-expect-error (non strict)
  const parent = item.type !== 'root' && item.parent ? ref.index[item.parent] : null;

  if (parent) {
    return [...getPath(parent, ref), parent.name];
  }
  return ref.id === DEFAULT_REF_ID ? [] : [ref.title || ref.id];
}

export const searchItem = (item: Item, ref: Parameters<typeof getPath>[1]): SearchItem => {
  return { ...item, refId: ref.id, path: getPath(item, ref) };
};

export function cycle<T>(array: T[], index: number, delta: number): number {
  let next = index + (delta % array.length);

  if (next < 0) {
    next = array.length + next;
  }

  if (next >= array.length) {
    next -= array.length;
  }
  return next;
}

export const scrollIntoView = (element: Element, center = false) => {
  if (!element) {
    return;
  }
  const { top, bottom } = element.getBoundingClientRect();
  if (!top || !bottom) {
    return;
  }
  const bottomOffset =
    document?.querySelector('#sidebar-bottom-wrapper')?.getBoundingClientRect().top ||
    globalWindow.innerHeight ||
    document.documentElement.clientHeight;
  if (bottom > bottomOffset) {
    element.scrollIntoView({ block: center ? 'center' : 'nearest' });
  }
};

export const getStateType = (
  isLoading: boolean,
  isAuthRequired: boolean,
  isError: boolean,
  isEmpty: boolean
) => {
  switch (true) {
    case isAuthRequired:
      return 'auth';
    case isError:
      return 'error';
    case isLoading:
      return 'loading';
    case isEmpty:
      return 'empty';
    default:
      return 'ready';
  }
};

export const isAncestor = (element?: Element, maybeAncestor?: Element): boolean => {
  if (!element || !maybeAncestor) {
    return false;
  }

  if (element === maybeAncestor) {
    return true;
  }
  return isAncestor(element.parentElement || undefined, maybeAncestor);
};

export const removeNoiseFromName = (storyName: string) => storyName.replaceAll(/(\s|-|_)/gi, '');

export const isStoryHoistable = (storyName: string, componentName: string) =>
  removeNoiseFromName(storyName) === removeNoiseFromName(componentName);

export const collapseSingleStoryComponents = (data: IndexHash): IndexHash => {
  {
    // Create a list of component IDs which should be collapsed into their (only) child.
    const singleStoryComponents: ComponentEntry[] = Object.values(data).filter(
      (entry): entry is ComponentEntry => {
        if (entry.type !== 'component') {
          return false;
        }

        const { children = [], name } = entry;

        if (children.length !== 1) {
          return false;
        }

        const onlyChild = data[children[0]];

        if (onlyChild.type === 'docs') {
          return true;
        }

        if (onlyChild.type === 'story' && onlyChild.subtype === 'story') {
          return isStoryHoistable(onlyChild.name, name);
        }
        return false;
      }
    );

    /* Replace each single-child component with its child story in the data set. */
    return singleStoryComponents.reduce(
      (acc, entry) => {
        const { children, parent, name } = entry;
        const [childId] = children;
        if (parent) {
          const parentEntry = data[parent] as GroupEntry;
          const siblings = [...parentEntry.children];
          siblings[siblings.indexOf(entry.id)] = childId;
          acc[parent] = { ...parentEntry, children: siblings };
        }
        acc[childId] = {
          ...(data[childId] as StoryEntry),
          name,
          // A hoisted story replacing a top-level component legitimately has no parent, even
          // though the API type declares `parent` as required for stories.
          parent: parent as StoryEntry['parent'],
          depth: data[childId].depth - 1,
        };
        // Remove the replaced component: indexToTree resolves rows from parent pointers, so a
        // surviving entry would render as a phantom row next to the hoisted story.
        delete acc[entry.id];
        return acc;
      },
      { ...data }
    );
  }
};

/**
 * The `IndexTree` is a hierarchical representation of `IndexHash`, that can be navigated from roots
 * to leaves. It is useful when rendering tree structures from the index (e.g. the sidebar Tree).
 */
export type TreeEntry = HashEntry & { resolvedChildren?: TreeEntry[] };
export type IndexTree = TreeEntry[];

export const indexToTree = (index: IndexHash): IndexTree => {
  const tree: IndexTree = [];
  const children: Record<string, HashEntry[]> = {};
  const processingQueue: IndexTree = [];

  // First pass over index to identify every node's children, and add root nodes to tree
  for (const item of Object.values(index)) {
    if (item.type === 'root' || !item.parent) {
      tree.push({ ...item, resolvedChildren: [] });
    } else {
      children[item.parent] = children[item.parent] || [];
      children[item.parent].push(item);
    }
  }

  // Now browse through tree to add every node's children to it
  processingQueue.push(...tree);
  while (processingQueue.length > 0) {
    const current = processingQueue.shift()!;
    const currentChildren = children[current.id] || [];
    current.resolvedChildren = currentChildren;
    processingQueue.push(...currentChildren);
  }

  return tree;
};
