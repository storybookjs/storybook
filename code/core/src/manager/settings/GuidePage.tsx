import React from 'react';

import { Link } from 'storybook/internal/components';

import { global } from '@storybook/global';

import { styled } from 'storybook/theming';

import { useChecklist } from '../components/sidebar/useChecklist';
import { Checklist } from './Checklist/Checklist';

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
  const checklist = useChecklist();

  return (
    <Container>
      <Intro>
        <h1>Guide</h1>
        <p>
          Whether you&apos;re just getting started or looking for ways to level up, this checklist
          will help you make the most of your Storybook.
        </p>
      </Intro>
      <Checklist {...checklist} />
      {global.FEATURES?.sidebarOnboardingChecklist !== false && (
        <>
          {checklist.openItems.length === 0 ? (
            <center>Your work here is done!</center>
          ) : checklist.widget.disable || checklist.openItems.every((item) => item.isMuted) ? (
            <center>
              Want to see this in the sidebar?{' '}
              <Link onClick={() => checklist.disable(false)}>Show in sidebar</Link>
            </center>
          ) : (
            <center>
              Don&apos;t want to see this in the sidebar?{' '}
              <Link onClick={() => checklist.mute(checklist.allItems.map(({ id }) => id))}>
                Remove from sidebar
              </Link>
            </center>
          )}
        </>
      )}
    </Container>
  );
};
