import type { FC } from 'react';
import React from 'react';
import { styled } from '@storybook/theming';
import { BookmarkHollowIcon, ComponentIcon, DocumentIcon, FolderIcon } from '@storybook/icons';
import { Button } from './button';
import { readableColor, tint } from 'polished';
import { cssVar } from '../../utils/cssVar';

const isCSSValue = (value: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(value) !== '';

const Manager = styled.div({
  width: '100%',
  height: 440,
  display: 'flex',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: 6,
  overflow: 'hidden',
});

const Sidebar = styled.div<{ isDefault: boolean }>(({ isDefault = true }) => ({
  background: isDefault
    ? '#F6F9FC'
    : `var(--sb-backgroundSidebar, var(--sb-background, ${tint(
        0.94,
        isCSSValue('--sb-accentSidebar')
          ? (cssVar('--sb-accentSidebar') as string)
          : (cssVar('--sb-accent') as string)
      )}))`,
  width: 250,
  height: '100%',
  flexShrink: 0,
  padding: 12,
  gap: 8,
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid rgba(0, 0, 0, 0.1)',
}));

const Right = styled.div({
  background: 'white',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

const Toolbar = styled.div({
  height: 40,
  width: '100%',
  background: 'var(--sb-background)',
  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 6px',
  gap: 6,
});

const Content = styled.div(() => ({
  flex: 1,
  background: 'white',
}));

const AddonsPanel = styled.div(() => ({
  height: 200,
  background: 'var(--sb-background)',
  borderTop: '1px solid rgba(0, 0, 0, 0.1)',
}));

const Line = styled.div<{ active?: boolean }>(({ active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 8px',
  borderRadius: 4,
  height: 28,
  fontSize: 14,
  color: active ? 'white' : readableColor(cssVar('--sb-background', '#fff')),
  background: active ? 'var(--sb-accentSidebar, var(--sb-accent))' : 'transparent',
  cursor: 'pointer',
  fontWeight: active ? 'bold' : 'normal',

  '&:hover': {
    background: active
      ? 'var(--sb-accentSidebar, var(--sb-accent))'
      : tint(0.9, cssVar('--sb-accent') as string),
  },
}));

const AddonsPanelHeader = styled.div(() => ({
  height: 40,
  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  display: 'flex',
}));

const ButtonAddonsPanel = styled.div(() => ({
  height: '100%',
  border: '0 solid transparent',
  borderTop: '3px solid transparent',
  borderBottom: '3px solid var(--sb-accent)',
  display: 'flex',
  alignItems: 'center',
  fontSize: 14,
  padding: '0 15px',
  color: 'var(--sb-accent)',
  fontWeight: 'bold',
}));

interface ThemeProps {
  accent?: string;
  background?: string;
  accentSidebar?: string;
  backgroundSidebar?: string;
  documentation?: string;
  directory?: string;
  component?: string;
  story?: string;
}

export const Theme: FC<ThemeProps> = () => {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--sb-accent');
  const background = getComputedStyle(document.documentElement).getPropertyValue('--sb-background');
  const isDefault = accent === '#029cfd' && background === '';

  return (
    <Manager>
      <Sidebar isDefault={isDefault} className="sidebar">
        <Line>
          <BookmarkHollowIcon
            style={{
              color: isDefault ? 'var(--sb-story, #37d5d3)' : 'var(--sb-story, var(--sb-accent))',
            }}
          />
          I'm a story
        </Line>
        <Line>
          <FolderIcon
            style={{
              color: isDefault
                ? 'var(--sb-directory, #6f2cac)'
                : 'var(--sb-directory, var(--sb-accent))',
            }}
          />
          I'm a directory
        </Line>
        <Line>
          <ComponentIcon
            style={{
              color: isDefault
                ? 'var(--sb-component, #029cfd)'
                : 'var(--sb-component, var(--sb-accent))',
            }}
          />
          I'm a component
        </Line>
        <Line>
          <DocumentIcon
            style={{
              color: isDefault
                ? 'var(--sb-documentation, #ffae00)'
                : 'var(--sb-documentation, var(--sb-accent))',
            }}
          />
          I'm a document
        </Line>
        <Line active>
          <BookmarkHollowIcon /> Hello World
        </Line>
        {/* <Button />
        <Button variant="outline" /> */}
      </Sidebar>
      <Right className="main">
        <Toolbar>
          <Button />
          <Button variant="outline" />
        </Toolbar>
        <Content />
        <AddonsPanel>
          <AddonsPanelHeader>
            <ButtonAddonsPanel>Controls</ButtonAddonsPanel>
          </AddonsPanelHeader>
        </AddonsPanel>
      </Right>
    </Manager>
  );
};
