import React, { useEffect, useRef } from 'react';

import { Form, IconButton, TooltipLinkList } from 'storybook/internal/components';
import type { Tag } from 'storybook/internal/types';

import {
  BatchAcceptIcon,
  CloseIcon,
  DocumentIcon,
  EyeCloseIcon,
  EyeIcon,
  ShareAltIcon,
} from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';

const BUILT_IN_TAGS = new Set([
  'dev',
  'test',
  'dev-only',
  'test-only',
  'docs-only',
  'autodocs',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
  'test-fn',
  'vitest',
  'svelte-csf',
  'svelte-csf-v4',
  'svelte-csf-v5',
]);

const Wrapper = styled.div({
  minWidth: 240,
  maxWidth: 300,
});

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 4,
  padding: 4,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

interface TagsFilterPanelProps {
  api: API;
  allTags: Map<Tag, number>;
  selectedTags: Tag[];
  indeterminateTags: Tag[];
  toggleTag: (tag: Tag) => void;
  setAllTags: (selected: boolean) => void;
  resetTags: () => void;
  inverted: boolean;
  setInverted: (inverted: boolean) => void;
  isDevelopment: boolean;
  isInitialSelection: boolean;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  selectedTags,
  indeterminateTags,
  toggleTag,
  setAllTags,
  resetTags,
  inverted,
  setInverted,
  isDevelopment,
  isInitialSelection,
}: TagsFilterPanelProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkboxes = ref.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (!checkboxes) {
      return;
    }
    for (const checkbox of checkboxes) {
      const tag = checkbox.getAttribute('data-tag');
      if (tag && indeterminateTags.includes(tag)) {
        checkbox.indeterminate = true;
      }
    }
  }, [indeterminateTags]);

  const [builtInEntries, userEntries] = Array.from(allTags.entries()).reduce(
    (acc, [tag, count]) => {
      acc[BUILT_IN_TAGS.has(tag) ? 0 : 1].push([tag, count]);
      return acc;
    },
    [[], []] as [[Tag, number][], [Tag, number][]]
  );

  const docsUrl = api.getDocsUrl({ subpath: 'writing-stories/tags#filtering-by-custom-tags' });

  const noTags = {
    id: 'no-tags',
    title: 'There are no tags. Use tags to organize and filter your Storybook.',
    isIndented: false,
  };

  const groups = [
    allTags.size === 0 ? [noTags] : [],
    userEntries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => {
        const checked = selectedTags.includes(tag);
        const id = `tag-${tag}`;
        return {
          id,
          title: tag,
          right: count,
          input: <Form.Checkbox checked={checked} onChange={() => toggleTag(tag)} data-tag={tag} />,
        };
      }),
    builtInEntries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => {
        const checked = selectedTags.includes(tag);
        const id = `tag-${tag}`;
        return {
          id,
          title: tag,
          right: count,
          input: <Form.Checkbox checked={checked} onChange={() => toggleTag(tag)} data-tag={tag} />,
        };
      }),
  ] as Link[][];

  if (userEntries.length === 0 && isDevelopment) {
    groups.push([
      {
        id: 'tags-docs',
        title: 'Learn how to add tags',
        icon: <DocumentIcon />,
        right: <ShareAltIcon />,
        href: docsUrl,
      },
    ]);
  }

  return (
    <Wrapper ref={ref}>
      {allTags.size > 0 && (
        <Actions>
          {isInitialSelection ? (
            <IconButton id="select-all" key="select-all" onClick={() => setAllTags(true)}>
              <BatchAcceptIcon />
              Select all
            </IconButton>
          ) : (
            <IconButton id="reset-filters" key="reset-filters" onClick={resetTags}>
              <CloseIcon />
              Reset filters
            </IconButton>
          )}
          <IconButton
            id="invert-selection"
            disabled={selectedTags.length === 0}
            onClick={() => setInverted(!inverted)}
            active={inverted}
          >
            {inverted ? <EyeCloseIcon /> : <EyeIcon />}
            Invert
          </IconButton>
        </Actions>
      )}
      <TooltipLinkList links={groups} />
    </Wrapper>
  );
};
