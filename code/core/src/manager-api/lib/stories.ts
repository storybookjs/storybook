import { sanitize } from 'storybook/internal/csf';
import type {
  API_ComponentEntry,
  API_DocsEntry,
  API_GroupEntry,
  API_IndexHash,
  API_LeafEntry,
  API_PreparedIndexEntry,
  API_PreparedStoryIndex,
  API_Provider,
  API_RootEntry,
  API_StoryEntry,
  DocsOptions,
  IndexEntry,
  Parameters,
  SetStoriesPayload,
  SetStoriesStoryData,
  StatusesByStoryIdAndTypeId,
  StoryId,
  StoryIndexV2,
  StoryIndexV3,
} from 'storybook/internal/types';

import { countBy } from 'es-toolkit/array';
import { mapValues } from 'es-toolkit/object';
import memoize from 'memoizerific';
import { dedent } from 'ts-dedent';

import { Tag } from '../../shared/constants/tags.ts';
import { type API, type State, combineParameters } from '../root.tsx';
import intersect from './intersect.ts';

const TITLE_PATH_SEPARATOR = /\s*\/\s*/;

export const denormalizeStoryParameters = ({
  globalParameters,
  kindParameters,
  stories,
}: SetStoriesPayload): SetStoriesStoryData => {
  return mapValues(stories, (storyData) => ({
    ...storyData,
    parameters: combineParameters(
      globalParameters,
      kindParameters[storyData.kind],
      storyData.parameters as unknown as Parameters
    ),
  })) as SetStoriesStoryData;
};

export const transformSetStoriesStoryDataToPreparedStoryIndex = (
  stories: SetStoriesStoryData
): API_PreparedStoryIndex => {
  const entries: API_PreparedStoryIndex['entries'] = Object.entries(stories).reduce(
    (acc, [id, story]) => {
      if (!story) {
        return acc;
      }

      const { docsOnly, fileName, ...parameters } = story.parameters;
      const base = {
        title: story.kind,
        id,
        name: story.name,
        importPath: fileName,
      };
      if (docsOnly) {
        acc[id] = {
          type: 'docs',
          tags: ['stories-mdx'],
          storiesImports: [],
          ...base,
        };
      } else {
        const { argTypes, args, initialArgs } = story;
        acc[id] = {
          type: 'story',
          subtype: 'story',
          ...base,
          parameters,
          argTypes,
          args,
          initialArgs,
        };
      }
      return acc;
    },
    {} as API_PreparedStoryIndex['entries']
  );

  return { v: 5, entries };
};

export const transformStoryIndexV2toV3 = (index: StoryIndexV2): StoryIndexV3 => {
  return {
    v: 3,
    stories: Object.values(index.stories).reduce(
      (acc, entry) => {
        acc[entry.id] = {
          ...entry,
          title: entry.kind,
          name: entry.name || entry.story,
          importPath: entry.parameters.fileName || '',
        };

        return acc;
      },
      {} as StoryIndexV3['stories']
    ),
  };
};

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
  input: API_PreparedStoryIndex | StoryIndexV2 | StoryIndexV3,
  { provider, docsOptions, filters, allStatuses, statusFilterKey }: ToStoriesHashOptions
): API_IndexHash => {
  if (!input.v) {
    throw new Error('Composition: Missing stories.json version');
  }

  let index = input;
  index = index.v === 2 ? transformStoryIndexV2toV3(index as any) : index;
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

  const setShowRoots = typeof showRoots !== 'undefined';

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

    // First, split the title into a set of names, separated by '/' and trimmed.
    const { title } = item;
    const groups = title.trim().split(TITLE_PATH_SEPARATOR);
    const root = (!setShowRoots || showRoots) && groups.length > 1 ? [groups.shift()] : [];
    const names = [...root, ...groups];

    // Now create a "path" or sub id for each name
    const paths = names.reduce((list, name, idx) => {
      const parent = idx > 0 && list[idx - 1];
      const id = sanitize(parent ? `${parent}-${name}` : name!);

      if (name!.trim() === '') {
        throw new Error(dedent`Invalid title ${title} ending in slash.`);
      }

      if (parent === id) {
        throw new Error(
          dedent`
          Invalid part '${name}', leading to id === parentId ('${id}'), inside title '${title}'

          Did you create a path that uses the separator char accidentally, such as 'Vue <docs/>' where '/' is a separator char? See https://github.com/storybookjs/storybook/issues/6128
          `
        );
      }
      list.push(id);
      return list;
    }, [] as string[]);

    paths.forEach((id, idx) => {
      const node = titleNodes.get(id) ?? {
        id,
        name: '',
        parent: paths[idx - 1],
        depth: idx,
        isRoot: false,
        children: [],
      };
      titleNodes.set(id, node);
      node.name = names[idx]!;
      node.isRoot ||= root.length > 0 && idx === 0;

      const childId = paths[idx + 1] ?? item.id;
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
    if (node.children.some((id) => titleNodes.has(id))) {
      return 'group';
    }
    if (node.children.some((id) => entriesById.get(id)!.type === 'story')) {
      return 'component';
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

    entry.tags = children
      .flatMap((id) => {
        const child = storiesHash[id];
        return child.type === 'story' && 'children' in child && child.children
          ? [id, ...child.children]
          : [id];
      })
      .map((id) => storiesHash[id].tags)
      .reduce(intersect);
    if (entry.type === 'component') {
      entry.importPath = (storiesHash[children[0]] as API_LeafEntry).importPath;
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

export const getComponentLookupList = memoize(1)((hash: API_IndexHash) => {
  return Object.entries(hash).reduce((acc, i) => {
    const value = i[1];
    if (value.type === 'component') {
      acc.push([...value.children]);
    } else if (
      value.type === 'docs' &&
      (!value.parent || hash[value.parent].type !== 'component')
    ) {
      acc.push([value.id]);
    }
    return acc;
  }, [] as StoryId[][]);
});

export const getStoriesLookupList = memoize(1)((hash: API_IndexHash) => {
  return Object.keys(hash).filter((k) => ['story', 'docs'].includes(hash[k].type));
});
