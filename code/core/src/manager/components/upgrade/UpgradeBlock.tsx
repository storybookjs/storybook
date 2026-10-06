import type { FC } from 'react';
import React from 'react';

import { Button, Link, TabList, TabPanel, useTabsState } from 'storybook/internal/components';

import { CheckIcon, CopyIcon } from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';

interface UpgradeBlockProps {
  onNavigateToWhatsNew?: () => void;
}

const UpgradeSnippet: FC<{ command: string }> = ({ command }) => {
  const { children, buttonProps } = useCopyButton({
    children: <CopyIcon />,
    childrenOnCopy: <CheckIcon />,
    content: command,
    ariaLabel: 'Copy command',
    ariaLabelOnCopy: 'Command copied',
  });

  return (
    <Code>
      {command}
      <Button variant="ghost" padding="small" size="small" {...buttonProps}>
        {children}
      </Button>
    </Code>
  );
};

export const UpgradeBlock: FC<UpgradeBlockProps> = ({ onNavigateToWhatsNew }) => {
  const api = useStorybookApi();
  const tabsState = useTabsState({
    defaultSelected: 'npm',
    tabs: [
      {
        id: 'npm',
        title: 'npm',
        children: <UpgradeSnippet command="npx storybook@latest upgrade" />,
      },
      {
        id: 'yarn',
        title: 'yarn',
        children: <UpgradeSnippet command="yarn dlx storybook@latest upgrade" />,
      },
      {
        id: 'pnpm',
        title: 'pnpm',
        children: <UpgradeSnippet command="pnpm dlx storybook@latest upgrade" />,
      },
    ],
  });

  return (
    <Container>
      <strong>You are on Storybook {api.getCurrentVersion().version}</strong>
      <p>Run the following script to check for updates and upgrade to the latest version.</p>
      <TabList state={tabsState} />
      <TabPanel state={tabsState} hasScrollbar={false} />
      {onNavigateToWhatsNew && (
        <Link onClick={onNavigateToWhatsNew}>See what's new in Storybook</Link>
      )}
    </Container>
  );
};

const Container = styled.div(({ theme }) => ({
  border: '1px solid',
  borderRadius: 5,
  padding: 20,
  marginTop: 0,
  borderColor: theme.appBorderColor,
  fontSize: theme.typography.size.s2,
  width: '100%',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    maxWidth: 400,
  },
}));

const Code = styled.pre(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  background: theme.base === 'light' ? 'rgba(0, 0, 0, 0.05)' : theme.appBorderColor,
  fontSize: theme.typography.size.s2 - 1,
  margin: '4px 0 16px',
}));
