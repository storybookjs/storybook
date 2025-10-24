import { CSSTransition } from 'react-transition-group';
import { styled } from 'storybook/theming';

export { TransitionGroup } from 'react-transition-group';

export const Transition = styled(CSSTransition)<{ timeout: number }>(({ timeout }) => ({
  '--transition-duration': `${timeout}ms`,

  '@media (prefers-reduced-motion: reduce)': {
    '--transition-duration': '0ms',
  },
}));
