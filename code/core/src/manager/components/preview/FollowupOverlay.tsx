import type { FC } from 'react';
import React from 'react';

import { Placeholder } from 'storybook/internal/components';
import type { API_DocsEntry, API_StoryEntry, StoryId } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

const Overlay = styled.div(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.background.content,
  zIndex: 2,
}));

const Panel = styled.div(({ theme }) => ({
  padding: 24,
  maxWidth: 520,
  color: theme.color.defaultText,
}));

const Heading = styled.h2(({ theme }) => ({
  margin: 0,
  marginBottom: 8,
  fontSize: theme.typography.size.m1,
  fontWeight: theme.typography.weight.bold,
}));

const List = styled.ul({
  listStyle: 'none',
  padding: 0,
  margin: '16px 0 0 0',
});

const Item = styled.li({
  marginBottom: 4,
});

const Link = styled.a(({ theme }) => ({
  color: theme.color.secondary,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
}));

const DocsButton = styled.button(({ theme }) => ({
  marginTop: 16,
  padding: '8px 12px',
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  color: theme.color.defaultText,
  cursor: 'pointer',
}));

export type FollowupOverlayProps = {
  heading: 'This story is no longer here' | 'This story was deleted';
  siblings: API_StoryEntry[];
  docsEntry?: API_DocsEntry;
  onSelect: (id: StoryId) => void;
};

export const FollowupOverlay: FC<FollowupOverlayProps> = ({
  heading,
  siblings,
  docsEntry,
  onSelect,
}) => {
  return (
    <Overlay role="status">
      <Placeholder>
        <Panel>
          <Heading>{heading}</Heading>
          {siblings.length > 0 && (
            <>
              <div>Here are some recently added stories:</div>
              <List>
                {siblings.map((s) => (
                  <Item key={s.id}>
                    <Link role="link" onClick={() => onSelect(s.id)} tabIndex={0}>
                      {s.title} — {s.name}
                    </Link>
                  </Item>
                ))}
              </List>
            </>
          )}
          {docsEntry && (
            <DocsButton onClick={() => onSelect(docsEntry.id)}>
              Take me to {docsEntry.title} docs
            </DocsButton>
          )}
        </Panel>
      </Placeholder>
    </Overlay>
  );
};
