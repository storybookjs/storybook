import React from 'react';

import { Link } from 'storybook/internal/components';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { CallStates } from '../../instrumenter/types';
import { DOCUMENTATION_DISCREPANCY_LINK } from '../constants';

const Wrapper = styled.div(({ theme: { color, typography, background } }) => ({
  textAlign: 'start',
  padding: '11px 15px',
  fontSize: `${typography.size.s2 - 1}px`,
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
  browserTestStatus?: CallStates;
}

export const TestDiscrepancyMessage = ({ browserTestStatus }: TestDiscrepancyMessageProps) => {
  const api = useStorybookApi();
  const docsUrl = api.getDocsUrl({
    subpath: DOCUMENTATION_DISCREPANCY_LINK,
    versioned: true,
    renderer: true,
  });
  const [passed, failed] =
    browserTestStatus === CallStates.ERROR
      ? ['the CLI', 'this browser']
      : ['this browser', 'the CLI'];

  return (
    <Wrapper>
      This interaction test passed in {passed}, but the tests failed in {failed}.{' '}
      <Link href={docsUrl} target="_blank" withArrow>
        Learn what could cause this
      </Link>
    </Wrapper>
  );
};
