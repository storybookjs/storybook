import { titleToPath } from 'storybook/internal/csf';
import type {
  API_ComponentEntry,
  API_DocsEntry,
  API_GroupEntry,
  API_HashEntry,
  API_IndexHash,
  API_LeafEntry,
  API_PreparedIndexEntry,
  API_PreparedStoryIndex,
  API_Provider,
  API_RootEntry,
  API_StoryEntry,
  DocsOptions,
  IndexEntry,
  StatusesByStoryIdAndTypeId,
  StoryId,
  StoryIndexV3,
} from 'storybook/internal/types';

import { countBy } from 'es-toolkit/array';
import memoize from 'memoizerific';

import { Tag } from '../../shared/constants/tags.ts';
import { type API, type State } from '../root.tsx';
import intersect from './intersect.ts';

/**
 * Whether an entry is one of a component's own docs or stories. A component's children can also
 * hold a subcomponent (`Components/Button/Icon` under `Components/Button`) or a docs entry hoisted
 * from a nested title because it is the only entry there (`Components/Button/Guide`, whose parent
 * is `components-button`). Only titles tell these apart: `type` and `parent` match in both cases.
 */
export const isOwnEntry = (
  component: Pick<API_ComponentEntry, 'id'>,
  entry: API_HashEntry | undefined
): entry is API_LeafEntry =>
  (entry?.type === 'docs' || entry?.type === 'story') &&
  titleToPath(entry.title).at(-1)?.id === component.id;

export const transformStoryIndexV3toV4 = (index: StoryIndexV3): API_PreparedStoryIndex => {
  const countByTitle = countBy(Object.values(index.stories), (item) => item.title);
  return {
    v: 4,
    entries: Object.values(index.stories).reduce(
      (acc, entry) => {
        let type: IndexEntry['type'] = 'story';
        if (
          entry.parameters?.docsOnly ||
          (entry.name === 'Page' && countByTitle[entry.title] === 1)
        ) {
          type = 'docs';
        }
        acc[entry.id] = {
          type,
          ...(type === 'docs' && { tags: ['stories-mdx'], storiesImports: [] }),
          ...entry,
        } as API_PreparedIndexEntry;

        // @ts-expect-error (we're removing something that should not be there)
        delete acc[entry.id].story;
        // @ts-expect-error (we're removing something that should not be there)
        delete acc[entry.id].kind;

        return acc;
      },
      {} as API_PreparedStoryIndex['entries']
    ),
  };
};

/**
 * Storybook 8.0 and below did not automatically tag stories with 'dev'. Therefore Storybook 8.1 and
 * above would not show composed 8.0 stories by default. This function adds the 'dev' tag to all
 * stories in the index to workaround this issue.
 */
export const transformStoryIndexV4toV5 = (
  index: API_PreparedStoryIndex
): API_PreparedStoryIndex => {
  return {
    v: 5,
    entries: Object.values(index.entries).reduce(
      (acc, entry) => {
        acc[entry.id] = {
          ...entry,
          tags: entry.tags ? [Tag.DEV, Tag.TEST, ...entry.tags] : [Tag.DEV],
        };

        return acc;
      },
      {} as API_PreparedStoryIndex['entries']
    ),
  };
};

type TitleNodeType = 'root' | 'group' | 'component' | 'docs';

type TitleNode = {
  id: StoryId;
  name: string;
  parent: StoryId | undefined;
  depth: number;
  isRoot: boolean;
  children: StoryId[];
};

type ToStoriesHashOptions = {
  provider: API_Provider<API>;
  docsOptions: DocsOptions;
  filters: State['filters'];
  allStatuses: StatusesByStoryIdAndTypeId;
  /** The key of the status filter in `filters`, if any. The status filter takes priority over the "always show error" rule. */
  statusFilterKey?: string;
};

export const transformStoryIndexToStoriesHash = (
  input: API_PreparedStoryIndex | StoryIndexV3,
  { provider, docsOptions, filters, allStatuses, statusFilterKey }: ToStoriesHashOptions
): API_IndexHash => {
  if (!input.v) {
    throw new Error('Composition: Missing stories.json version');
  }
  if (input.v < 3) {
    throw new Error(
      `Unsupported story index version: v${input.v}. Storybook 11 requires index version 3 or later.`
    );
  }

  let index = input;
  index = index.v === 3 ? transformStoryIndexV3toV4(index as any) : index;
  index = index.v === 4 ? transformStoryIndexV4toV5(index as any) : index;
  index = index as API_PreparedStoryIndex;

  const indexEntries = Object.values(index.entries);
  const filterFunctions = Object.values(filters);
  const statusFilterFn = statusFilterKey ? filters[statusFilterKey] : undefined;

  const entryValues = indexEntries.filter((entry) => {
    const statuses = allStatuses[entry.id] ?? {};

    // The status filter runs first and can hide entries even if they have a failing status.
    // This allows users to explicitly filter by status (e.g. exclude error stories).
    if (statusFilterFn && !statusFilterFn({ ...entry, statuses })) {
      const children = indexEntries.filter((item) => 'parent' in item && item.parent === entry.id);
      if (
        !children.some((child) =>
          statusFilterFn({ ...child, statuses: allStatuses[child.id] ?? {} })
        )
      ) {
        return false;
      }
    }

    if (Object.values(statuses).some(({ value }) => value === 'status-value:error')) {
      // All stories with a failing status should always show up, regardless of the applied non-status filters
      return true;
    }

    if (filterFunctions.every((fn) => fn({ ...entry, statuses }))) {
      return true;
    }

    const children = indexEntries.filter((item) => 'parent' in item && item.parent === entry.id);
    return children.some((child) => filterFunctions.every((fn) => fn({ ...child, statuses })));
  });

  const { sidebar = {} } = provider.getConfig();
  const { showRoots, collapsedRoots = [], renderAriaLabel, renderLabel } = sidebar;

  const includedIds = new Set(entryValues.map((entry) => entry.id));
  const entriesById = new Map<StoryId, API_PreparedIndexEntry>();
  const titleNodes = new Map<StoryId, TitleNode>();
  const testIdsByStoryId = new Map<StoryId, StoryId[]>();

  indexEntries.forEach((item) => {
    if (docsOptions.docsMode && item.type !== 'docs') {
      return;
    }
    entriesById.set(item.id, item);

    if ('parent' in item && item.parent) {
      testIdsByStoryId.set(item.parent, [...(testIdsByStoryId.get(item.parent) ?? []), item.id]);
      return;
    }

    const paths = titleToPath(item.title);
    const hasRoot = showRoots !== false && paths.length > 1;

    paths.forEach(({ id, name }, idx) => {
      const node = titleNodes.get(id) ?? {
        id,
        name: '',
        parent: paths[idx - 1]?.id,
        depth: idx,
        isRoot: false,
        children: [],
      };
      titleNodes.set(id, node);
      node.name = name;
      node.isRoot ||= hasRoot && idx === 0;

      const childId = paths[idx + 1]?.id ?? item.id;
      if (!node.children.includes(childId)) {
        node.children.push(childId);
      }
    });
  });

  // A title's type follows from everything indexed under it, never from the active filters
  const typeOf = (node: TitleNode): TitleNodeType => {
    if (node.isRoot) {
      return 'root';
    }
    if (node.children.some((id) => entriesById.get(id)?.type === 'story')) {
      return 'component';
    }
    if (node.children.some((id) => titleNodes.has(id))) {
      return 'group';
    }
    return node.children.length === 1 ? 'docs' : 'group';
  };

  const isIncluded = (id: StoryId): boolean => {
    const node = titleNodes.get(id);
    return node ? node.children.some(isIncluded) : includedIds.has(id);
  };

  const hashIdOf = (id: StoryId) => {
    const node = titleNodes.get(id);
    return node && typeOf(node) === 'docs' ? node.children[0] : id;
  };

  const storiesHash: API_IndexHash = {};
  // The tags shared by the stories (and tests) under each node; absent when no story is shown there
  const storyTagsById = new Map<StoryId, string[]>();

  const addLeaf = (id: StoryId, parent: StoryId | undefined, depth: number) => {
    const item = entriesById.get(id)!;
    storiesHash[id] = {
      tags: [],
      ...item,
      depth,
      parent,
      renderAriaLabel,
      renderLabel,
      prepared: !!item.parameters,
    } as API_DocsEntry | API_StoryEntry;
    if (item.type === 'story') {
      storyTagsById.set(id, storiesHash[id].tags);
    }

    const testIds = (testIdsByStoryId.get(id) ?? []).filter((testId) => includedIds.has(testId));
    if (testIds.length) {
      (storiesHash[id] as API_StoryEntry).children = testIds;
      testIds.forEach((testId) => addLeaf(testId, id, depth + 1));
    }
  };

  const addNode = (node: TitleNode) => {
    const type = typeOf(node);
    if (type === 'docs') {
      addLeaf(node.children[0], node.parent, node.depth);
      storiesHash[node.children[0]].name = node.name;
      return;
    }

    const includedChildren = node.children.filter(isIncluded);
    const children = includedChildren.map(hashIdOf);
    const entry = {
      type,
      id: node.id,
      name: node.name,
      depth: node.depth,
      tags: [] as string[],
      renderAriaLabel,
      renderLabel,
      children,
      ...(type === 'root'
        ? { startCollapsed: collapsedRoots.includes(node.id) }
        : { parent: node.parent }),
    } as API_RootEntry | API_GroupEntry | API_ComponentEntry;
    storiesHash[node.id] = entry;

    includedChildren.forEach((childId) => {
      const child = titleNodes.get(childId);
      if (child) {
        addNode(child);
      } else {
        addLeaf(childId, node.id, node.depth + 1);
      }
    });

    const leafIds = children.flatMap((id) => {
      const child = storiesHash[id];
      return child.type === 'story' && 'children' in child && child.children
        ? [id, ...child.children]
        : [id];
    });
    const storyTagLists = leafIds.flatMap((id) => {
      const tags = storyTagsById.get(id);
      return tags ? [tags] : [];
    });
    const storyTags = storyTagLists.length > 0 ? storyTagLists.reduce(intersect) : undefined;
    if (storyTags) {
      storyTagsById.set(node.id, storyTags);
    }
    // A component's tags come from its stories, also those of nested titles. Docs entries count only
    // when no story is shown.
    entry.tags =
      type === 'component' && storyTags
        ? storyTags
        : leafIds.map((id) => storiesHash[id].tags).reduce(intersect);
    if (entry.type === 'component') {
      // Prefer the first visible own entry; fall back to a hidden one when only subcomponents pass the filters
      const isOwnEntry = (id: StoryId) => entriesById.has(id);
      const childId = includedChildren.find(isOwnEntry) ?? node.children.find(isOwnEntry)!;
      entry.importPath = entriesById.get(childId)!.importPath;
    }
  };

  const topLevelNodes = [...titleNodes.values()].filter(
    (node) => node.depth === 0 && isIncluded(node.id)
  );
  topLevelNodes.filter((node) => !node.isRoot).forEach(addNode);
  topLevelNodes.filter((node) => node.isRoot).forEach(addNode);

  return storiesHash;
};

/** Now we need to patch in the existing prepared stories */
export const addPreparedStories = (newHash: API_IndexHash, oldHash?: API_IndexHash) => {
  if (!oldHash) {
    return newHash;
  }

  return Object.fromEntries(
    Object.entries(newHash).map(([id, newEntry]) => {
      const oldEntry = oldHash[id];
      if (newEntry.type === 'story' && oldEntry?.type === 'story' && oldEntry.prepared) {
        if ('children' in oldEntry) {
          // Prevent old entry from re-adding children if the story no longer has any (e.g. due to filters)
          delete oldEntry.children;
        }
        return [id, { ...oldEntry, ...newEntry, prepared: true }];
      }

      return [id, newEntry];
    })
  );
};

/**
 * Lists the groups that component jumps (Alt+arrow) move between, in sidebar order. A component's
 * own entries form one group, a subcomponent or hoisted nested docs page forms its own.
 */
export const getComponentLookupList = memoize(1)((hash: API_IndexHash) => {
  const lists: StoryId[][] = [];
  const visit = (id: StoryId) => {
    const entry = hash[id];
    if (entry.type === 'component') {
      let ownEntries: StoryId[] = [];
      entry.children.forEach((childId) => {
        if (isOwnEntry(entry, hash[childId])) {
          ownEntries.push(childId);
          return;
        }
        if (ownEntries.length) {
          lists.push(ownEntries);
          ownEntries = [];
        }
        visit(childId);
      });
      if (ownEntries.length) {
        lists.push(ownEntries);
      }
    } else if (entry.type === 'docs') {
      lists.push([entry.id]);
    } else if (entry.type === 'root' || entry.type === 'group') {
      entry.children.forEach(visit);
    }
  };
  Object.values(hash)
    .filter((entry) => !('parent' in entry && entry.parent))
    .forEach((entry) => visit(entry.id));
  return lists;
});

export const getStoriesLookupList = memoize(1)((hash: API_IndexHash) => {
  return Object.keys(hash).filter((k) => ['story', 'docs'].includes(hash[k].type));
});
