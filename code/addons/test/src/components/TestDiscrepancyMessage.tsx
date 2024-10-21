import React, { useEffect } from 'react';

import { Link } from 'storybook/internal/components';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';
import type { StoryId } from 'storybook/internal/types';

import { CallStates } from '@storybook/instrumenter';

import { DOCUMENTATION_DISCREPANCY_LINK, STORYBOOK_ADDON_TEST_CHANNEL } from '../constants';

const Wrapper = styled.div(({ theme: { color, typography, background } }) => ({
  textAlign: 'start',
  padding: '11px 15px',
  fontSize: `${typography.size.s2}px`,
  fontWeight: typography.weight.regular,
  lineHeight: '1rem',
  background: background.app,
  borderBottom: `1px solid ${color.border}`,
  color: color.defaultText,
  backgroundClip: 'padding-box',
  position: 'relative',
  code: {
    fontSize: `${typography.size.s1 - 1}px`,
    color: 'inherit',
    margin: '0 0.2em',
    padding: '0 0.2em',
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '2px',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1)',
  },
}));

interface TestDiscrepancyMessageProps {
  browserTestStatus: CallStates;
  storyId: StoryId;
  testRunId: string;
}
export const TestDiscrepancyMessage = ({
  browserTestStatus,
  storyId,
  testRunId,
}: TestDiscrepancyMessageProps) => {
  const api = useStorybookApi();
  const docsUrl = api.getDocsUrl({
    subpath: DOCUMENTATION_DISCREPANCY_LINK,
    versioned: true,
    renderer: true,
  });
  const message = `This component test passed in ${browserTestStatus === CallStates.DONE ? 'this browser' : 'CLI'}, but the tests failed in ${browserTestStatus === CallStates.ERROR ? 'this browser' : 'CLI'}.`;

  useEffect(
    () =>
      api.emit(STORYBOOK_ADDON_TEST_CHANNEL, {
        type: 'test-discrepancy',
        payload: {
          browserStatus: browserTestStatus === CallStates.DONE ? 'PASS' : 'FAIL',
          cliStatus: browserTestStatus === CallStates.DONE ? 'FAIL' : 'PASS',
          storyId,
          testRunId,
        },
      }),
    [api, browserTestStatus, storyId, testRunId]
  );

  return (
    <Wrapper>
      {message}{' '}
      <Link href={docsUrl} target="_blank" withArrow>
        Learn what could cause this
      </Link>
    </Wrapper>
  );
};
