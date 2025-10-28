import React, { useMemo } from 'react';

import { Button, Link } from 'storybook/internal/components';

import { universalChecklistStore } from '#manager-stores';
import { checklistStore } from '#manager-stores';
import { experimental_useUniversalStore } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { Checklist } from './Checklist/Checklist';
import { checklistData } from './Checklist/checklistData';

const Container = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 600,
  margin: '0 auto',
  padding: '48px 20px',
  gap: 32,
  fontSize: theme.typography.size.s2,
  '--transition-duration': '0.2s',
}));

const Intro = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,

  '& h1': {
    fontSize: theme.typography.size.m3,
    fontWeight: theme.typography.weight.bold,
    margin: 0,
  },

  '& > p': {
    margin: 0,
  },
}));

export const GuidePage = () => {
  const allTaskIds = checklistData.sections.flatMap(({ items }) => items.map(({ id }) => id));
  const [checklistState] = experimental_useUniversalStore(universalChecklistStore);
  const { muted } = checklistState;

  return (
    <Container>
      <Intro>
        <h1>Guide</h1>
        <p>
          Learn the basics. Set up Storybook. You know the drill. This isn't your first time setting
          up software so get to it!
        </p>
      </Intro>
      <Checklist data={checklistData} state={checklistState} store={checklistStore} />
      {muted ? (
        <center>
          Want to see this in the sidebar?{' '}
          <Link onClick={() => checklistStore.mute(false)}>Show in sidebar</Link>
        </center>
      ) : (
        <center>
          Don&apos;t want to see this in the sidebar?{' '}
          <Link onClick={() => checklistStore.mute(allTaskIds)}>Remove from sidebar</Link>
        </center>
      )}
    </Container>
  );
};
