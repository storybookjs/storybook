import type { Tag } from 'storybook/internal/types';

export const BUILT_IN_URL_TAG_MAP: Record<string, Tag> = {
  $changed: '_changed',
  $docs: '_docs',
  $play: '_play',
  $test: '_test',
};

export const parseTagsParam = (
  tagsParam: string | undefined
): { included: Tag[]; excluded: Tag[] } => {
  if (!tagsParam) {
    return { included: [], excluded: [] };
  }

  const included: Tag[] = [];
  const excluded: Tag[] = [];

  tagsParam.split(';').forEach((rawTag) => {
    if (!rawTag) {
      return;
    }

    const isExcluded = rawTag.startsWith('!');
    const normalizedTag = isExcluded ? rawTag.slice(1) : rawTag;
    const mappedTag = (BUILT_IN_URL_TAG_MAP[normalizedTag] ?? normalizedTag) as Tag;

    if (isExcluded) {
      excluded.push(mappedTag);
    } else {
      included.push(mappedTag);
    }
  });

  return { included, excluded };
};

export const serializeTagsParam = (included: Tag[], excluded: Tag[]): string => {
  if (!included.length && !excluded.length) {
    return '';
  }

  const reverseBuiltInUrlTagMap = Object.fromEntries(
    Object.entries(BUILT_IN_URL_TAG_MAP).map(([urlTag, internalTag]) => [internalTag, urlTag])
  ) as Record<string, string>;

  const serializedIncluded = included.map((tag) => reverseBuiltInUrlTagMap[tag] ?? tag);
  const serializedExcluded = excluded.map((tag) => `!${reverseBuiltInUrlTagMap[tag] ?? tag}`);

  return [...serializedIncluded, ...serializedExcluded].join(';');
};
