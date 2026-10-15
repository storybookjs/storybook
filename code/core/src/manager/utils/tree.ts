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

/**
 * The first story or docs page under an entry, resolved the way `api.selectStory` resolves a
 * component or group: the first child present in the index, down to a leaf.
 */
export const findFirstLeafId = (
  data: Record<string, HashEntry>,
  id: string
): string | undefined => {
  const entry = data[id];
  if (!entry) {
    return undefined;
  }
  if (entry.type === 'docs' || entry.type === 'story') {
    return entry.id;
  }
  const childId = entry.children.find((child) => data[child]);
  return childId ? findFirstLeafId(data, childId) : undefined;
};
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

/** The id of the "Story" row of a story with tests (see `addStoryRows`). */
export const storyRowId = (storyId: string) => `${storyId}--story`;

/** The "Story" row of a story with tests. It opens the story it stands in for. */
export type StoryRowEntry = StoryEntry & { storyRowOf: string };

export function isStoryRow(entry: HashEntry | undefined): entry is StoryRowEntry {
  return !!entry && 'storyRowOf' in entry;
}

/**
 * Give every story with tests a leaf child named "Story" that opens the story itself. A story with
 * tests is a branch, so a press on its own row toggles the tests, as a component's row toggles its
 * stories. The child row keeps the story reachable with the pointer, as the "Docs" child of a
 * component keeps its docs page reachable.
 */
export const addStoryRows = (data: IndexHash): IndexHash => {
  // Rows render in the order of the hash, so the new row goes in right after its story: before
  // the tests, which the index lists after the story.
  const result: IndexHash = {};
  let added = false;
  for (const entry of Object.values(data)) {
    if (entry.type !== 'story' || entry.subtype !== 'story' || !isBranch(entry)) {
      result[entry.id] = entry;
      continue;
    }
    const { children, ...rest } = entry;
    const row: StoryRowEntry = {
      ...rest,
      id: storyRowId(entry.id),
      name: 'Story',
      parent: entry.id,
      depth: entry.depth + 1,
      storyRowOf: entry.id,
    };
    result[entry.id] = { ...entry, children: [row.id, ...children] };
    result[row.id] = row;
    added = true;
  }
  return added ? result : data;
};

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
