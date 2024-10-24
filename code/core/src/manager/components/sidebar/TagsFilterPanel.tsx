import React from 'react';

import { TooltipLinkList } from '@storybook/core/components';
import { styled, useTheme } from '@storybook/core/theming';
import { ShareAltIcon } from '@storybook/icons';
import type { Tag } from '@storybook/types';

import type { API } from '@storybook/core/manager-api';

const BUILT_IN_TAGS_SHOW = new Set(['play-fn']);

const Wrapper = styled.div({
  minWidth: 180,
  maxWidth: 220,
});

interface TagsFilterPanelProps {
  api: API;
  allTags: Tag[];
  selectedTags: Tag[];
  toggleTag: (tag: Tag) => void;
  isDevelopment: boolean;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  selectedTags,
  toggleTag,
  isDevelopment,
}: TagsFilterPanelProps) => {
  const theme = useTheme();
  const userTags = allTags.filter((tag) => !BUILT_IN_TAGS_SHOW.has(tag));
  const docsUrl = api.getDocsUrl({ subpath: 'writing-stories/tags#filtering-by-custom-tags' });
  const items = allTags.map((tag) => {
    const checked = selectedTags.includes(tag);
    const id = `tag-${tag}`;
    return {
      id,
      title: tag,
      right: <input type="checkbox" id={id} name={id} value={tag} checked={checked} />,
      onClick: () => toggleTag(tag),
    };
  }) as any[];

  if (allTags.length === 0) {
    items.push({
      id: 'no-tags',
      title: 'There are no tags. Use tags to organize and filter your Storybook.',
      isIndented: false,
    });
  }
  if (userTags.length === 0 && isDevelopment) {
    items.push({
      id: 'tags-docs',
      title: 'Learn how to add tags',
      icon: <ShareAltIcon />,
      href: docsUrl,
      style: {
        borderTop: `4px solid ${theme.appBorderColor}`,
      },
    });
  }

  return (
    <Wrapper>
      <TooltipLinkList links={items} />
    </Wrapper>
  );
};
