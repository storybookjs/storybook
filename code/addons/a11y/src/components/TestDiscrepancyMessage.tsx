import React, { useMemo } from 'react';

import { Link } from 'storybook/internal/components';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { DOCUMENTATION_DISCREPANCY_LINK } from '../constants';

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

export type TestDiscrepancy =
  | 'browserPassedCliFailed'
  | 'cliPassedBrowserFailed'
  | 'cliFailedButModeManual'
  | null;

interface TestDiscrepancyMessageProps {
  discrepancy: TestDiscrepancy;
}
export const TestDiscrepancyMessage = ({ discrepancy }: TestDiscrepancyMessageProps) => {
  const api = useStorybookApi();
  const docsUrl = api.getDocsUrl({
    subpath: DOCUMENTATION_DISCREPANCY_LINK,
    versioned: true,
    renderer: true,
  });

  const message = useMemo(() => {
    switch (discrepancy) {
      case 'browserPassedCliFailed':
        return 'Accessibility checks passed in this browser but failed in the CLI.';
      case 'cliPassedBrowserFailed':
        return 'Accessibility checks passed in the CLI but failed in this browser.';
      case 'cliFailedButModeManual':
        return 'Accessibility checks failed in the CLI. Run the tests manually to see the results.';
      default:
        return null;
    }
  }, [discrepancy]);

  if (!message) {
    return null;
  }

  return (
    <Wrapper>
      {message}{' '}
      <Link href={docsUrl} target="_blank" withArrow>
        Learn what could cause this
      </Link>
    </Wrapper>
  );
};
