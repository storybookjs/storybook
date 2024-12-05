import React, { type ComponentProps } from 'react';

import { type TestProviderConfig, type TestProviderState } from 'storybook/internal/core-events';
import { styled } from 'storybook/internal/theming';

const Wrapper = styled.div<{ crashed?: boolean }>(({ crashed, theme }) => ({
  fontSize: theme.typography.size.s1,
  fontWeight: crashed ? 'bold' : 'normal',
  color: crashed ? theme.color.negativeText : theme.color.defaultText,
}));

export const Title = ({
  state,
  ...props
}: { state: TestProviderConfig & TestProviderState } & ComponentProps<typeof Wrapper>) => {
  return (
    <Wrapper crashed={state.crashed} {...props}>
      {state.crashed || state.failed ? 'Local tests failed' : 'Run local tests'}
    </Wrapper>
  );
};
