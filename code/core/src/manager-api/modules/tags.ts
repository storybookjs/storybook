import type {
  API_PreparedIndexEntry,
  FilterFunction,
  Tag,
  TagsOptions,
} from 'storybook/internal/types';

import memoize from 'memoizerific';

import { parseFilterParam } from '../lib/filter-param.ts';
import { BUILT_IN_FILTERS, Tag as TagEnum, USER_TAG_FILTER } from '../../shared/constants/tags.ts';

export const BUILT_IN_URL_TAG_MAP: Record<string, Tag> = {
  $docs: '_docs',
  $play: '_play',
  $test: '_test',
};

export const parseTagsParam = (
  tagsParam: string | undefined
): { included: Tag[]; excluded: Tag[] } =>
  parseFilterParam(tagsParam, (raw) => (BUILT_IN_URL_TAG_MAP[raw] ?? raw) as Tag);

export const serializeTagsParam = (included: Tag[], excluded: Tag[]): string => {
  if (!included.length && !excluded.length) {
    return '';
  }

  const reverseBuiltInUrlTagMap = Object.fromEntries(
    Object.entries(BUILT_IN_URL_TAG_MAP).map(([urlTag, internalTag]) => [internalTag, urlTag])
  ) as Record<string, string>;

  const serializedIncluded = included.map((tag) => reverseBuiltInUrlTagMap[tag] ?? tag).sort();
  const serializedExcluded = excluded
    .map((tag) => `!${reverseBuiltInUrlTagMap[tag] ?? tag}`)
    .sort();

  return [...serializedIncluded, ...serializedExcluded].join(';');
};

export const getDefaultTagsFromPreset = memoize(1)((
  presets: TagsOptions
): {
  included: Tag[];
  excluded: Tag[];
} => {
  const presetEntries = Object.entries(presets);
  return {
    included: presetEntries
      .filter(([, option]) => option.defaultFilterSelection === 'include')
      .map(([tag]) => tag),
    excluded: presetEntries
      .filter(([, option]) => option.defaultFilterSelection === 'exclude')
      .map(([tag]) => tag),
  };
});

export const computeStaticFilterFn = (tagPresets: TagsOptions) => {
  const staticExcludeTags = Object.entries(tagPresets).reduce(
    (acc, entry) => {
      const [tag, option] = entry;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((option as any).excludeFromSidebar) {
        acc[tag] = true;
      }
      return acc;
    },
    {} as Record<string, boolean>
  );

  return (item: API_PreparedIndexEntry) => {
    const tags = item.tags ?? [];
    // Docs entry kinds are distinguished by system tags at index time:
    // - autodocs: type `docs`, no `attached-mdx` / `unattached-mdx` (importPath is the CSF file)
    // - attached MDX: `attached-mdx`
    // - unattached MDX: `unattached-mdx`
    // Autodocs inherit CSF meta tags (e.g. `!dev`) and must stay in the sidebar; MDX should
    // respect `!dev` like stories. See 15d7ef9149d.
    const isCsfAutodocsEntry =
      item.type === 'docs' &&
      !tags.includes(TagEnum.ATTACHED_MDX) &&
      !tags.includes(TagEnum.UNATTACHED_MDX);
    return (
      (tags.includes(TagEnum.DEV) || isCsfAutodocsEntry) &&
      tags.filter((tag) => staticExcludeTags[tag]).length === 0
    );
  };
};

export const computeTagsFilterFn = (
  includedTagFilters: Tag[],
  excludedTagFilters: Tag[]
): ((item: API_PreparedIndexEntry) => boolean) => {
  const computeFilterFunctions = (set: Tag[]): FilterFunction[][] => {
    return Object.values(
      set.reduce(
        (acc, tag) => {
          if (Object.hasOwn(BUILT_IN_FILTERS, tag)) {
            acc['built-in'].push(BUILT_IN_FILTERS[tag as keyof typeof BUILT_IN_FILTERS]);
          } else {
            acc.user.push(USER_TAG_FILTER(tag));
          }
          return acc;
        },
        { 'built-in': [], user: [] } as { 'built-in': FilterFunction[]; user: FilterFunction[] }
      )
    ).filter((group) => group.length > 0);
  };

  return (item: API_PreparedIndexEntry) => {
    const included = computeFilterFunctions(includedTagFilters);
    const excluded = computeFilterFunctions(excludedTagFilters);

    return (
      (!included.length ||
        included.every((group) => group.some((filterFn) => filterFn(item, false)))) &&
      (!excluded.length ||
        excluded.every((group) => group.every((filterFn) => filterFn(item, true))))
    );
  };
};
