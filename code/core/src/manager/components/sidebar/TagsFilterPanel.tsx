import React from 'react';

import { TooltipLinkList } from '@storybook/core/components';
import { styled, useTheme } from '@storybook/core/theming';
import { ShareAltIcon } from '@storybook/icons';
import type { Tag } from '@storybook/types';

import type { API } from '@storybook/core/manager-api';

const BUILT_IN_TAGS = new Set([
  'dev',
  'docs-only',
  'test-only',
  'autodocs',
  'test',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
]);

const Wrapper = styled.div({
  minWidth: 180,
  maxWidth: 220,
});

interface TagsFilterPanelProps {
  api: API;
  allTags: Tag[];
  selectedTags: Tag[];
  toggleTag: (tag: Tag) => void;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  selectedTags,
  toggleTag,
}: TagsFilterPanelProps) => {
  const theme = useTheme();
  const userTags = allTags.filter((tag) => tag === 'play-fn' || !BUILT_IN_TAGS.has(tag)).toSorted();
  const docsUrl = api.getDocsUrl({ subpath: 'writing-stories/tags' });
  const items =
    userTags.length === 0
      ? [
          {
            id: 'no-tags',
            title: 'There are no tags. Use tags to organize and filter your Storybook.',
            isIndented: false,
            style: {
              borderBottom: `4px solid ${theme.appBorderColor}`,
            },
          },
          {
            id: 'tags-docs',
            title: 'Learn how to add tags',
            icon: <ShareAltIcon />,
            href: docsUrl,
          },
        ]
      : userTags.map((tag) => {
          const checked = selectedTags.includes(tag);
          const id = `tag-${tag}`;
          return {
            id,
            title: tag,
            right: <input type="checkbox" id={id} name={id} value={tag} checked={checked} />,
            onClick: () => toggleTag(tag),
          };
        });

  return (
    <Wrapper>
      <TooltipLinkList links={items} />
    </Wrapper>
  );
};
