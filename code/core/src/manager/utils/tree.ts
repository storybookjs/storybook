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
import type { Dataset, Item, RefType } from '../components/sidebar/types.ts';

const { document, window: globalWindow } = global;

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
export function getPath(item: Item, ref: Pick<RefType, 'id' | 'title' | 'index'>): string[] {
  // @ts-expect-error (non strict)
  const parent = item.type !== 'root' && item.parent ? ref.index[item.parent] : null;

  if (parent) {
    return [...getPath(parent, ref), parent.name];
  }
  return ref.id === DEFAULT_REF_ID ? [] : [ref.title || ref.id];
}

export const searchItem = <T extends Item>(
  item: T,
  ref: Parameters<typeof getPath>[1]
): T & { refId: string; path: string[] } => {
  return { ...item, refId: ref.id, path: getPath(item, ref) };
};

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

export const removeNoiseFromName = (storyName: string) => storyName.replaceAll(/(\s|-|_)/gi, '');

export const isStoryHoistable = (storyName: string, componentName: string) =>
  removeNoiseFromName(storyName) === removeNoiseFromName(componentName);

export const hoistSingleStoryComponents = (data: IndexHash): IndexHash => {
  // Collect the components that must collapse into their only child.
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

  return singleStoryComponents.reduce(
    (acc, entry) => {
      const { children, parent, name } = entry;
      const [childId] = children;
      if (parent) {
        // Read from the accumulator, not from the source data. An earlier collapse can
        // already have rewritten the children of this parent, and the source copy is stale.
        const parentEntry = acc[parent] as GroupEntry;
        const siblings = [...parentEntry.children];
        siblings[siblings.indexOf(entry.id)] = childId;
        acc[parent] = { ...parentEntry, children: siblings };
      }
      acc[childId] = {
        ...(data[childId] as StoryEntry),
        name,
        // A hoisted story that replaces a top-level component has no parent. The API type
        // declares `parent` as required for a story, so this cast is necessary.
        parent: parent as StoryEntry['parent'],
        depth: data[childId].depth - 1,
      };
      // Move the subtree of the hoisted story, for example its test entries, up as well.
      // Without this, its rows indent one level too deep and report the wrong aria level.
      const hoistDescendants = (ids?: string[]) => {
        for (const id of ids ?? []) {
          const descendant = acc[id];
          if (!descendant) {
            continue;
          }
          acc[id] = { ...descendant, depth: descendant.depth - 1 };
          hoistDescendants((descendant as { children?: string[] }).children);
        }
      };
      hoistDescendants((data[childId] as { children?: string[] }).children);
      // Remove the replaced component. indexToTree resolves rows from the parent pointers, so
      // an entry that remains renders an extra row next to the hoisted story.
      delete acc[entry.id];
      return acc;
    },
    { ...data }
  );
};

/** Whether an entry is a branch: it has at least one child row. */
export function isBranch<T extends HashEntry>(entry: T): entry is T & { children: string[] } {
  return 'children' in entry && Array.isArray(entry.children) && entry.children.length > 0;
}

export type TreeEntry = HashEntry & { resolvedChildren?: TreeEntry[] };

/**
 * A hierarchical representation of the `IndexHash`. Navigation goes from the roots to the leaves.
 * Use it to render a tree from the index, for example the sidebar Tree.
 */
export type IndexTree = TreeEntry[];

export const indexToTree = (index: IndexHash): IndexTree => {
  const tree: IndexTree = [];
  const children: Record<string, TreeEntry[]> = {};
  const processingQueue: IndexTree = [];

  // Collect the children of every node and add the root nodes to the tree.
  // Copy every node. The entries are shared with the manager-api state hash, so a change in
  // place would leak the resolvedChildren subtrees into every other consumer.
  for (const item of Object.values(index)) {
    const entry: TreeEntry = { ...item, resolvedChildren: [] };
    if (item.type === 'root' || !item.parent) {
      tree.push(entry);
    } else {
      children[item.parent] = children[item.parent] || [];
      children[item.parent].push(entry);
    }
  }

  // Walk the tree and attach the children of every node.
  processingQueue.push(...tree);
  while (processingQueue.length > 0) {
    const current = processingQueue.shift()!;
    const currentChildren = children[current.id] || [];
    current.resolvedChildren = currentChildren;
    processingQueue.push(...currentChildren);
  }

  return tree;
};
