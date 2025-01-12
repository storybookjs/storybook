import { styled } from '@storybook/core/theming';

export const SideBySide = styled.div({
  display: 'grid',
  gridColumnGap: 30,
  gridTemplateColumns: '1fr 1fr',

  position: 'absolute',
  width: '100vw',
  height: '100vh',
  overflow: 'auto',
  top: 0,
  left: 0,

  '& > *': {
    padding: 20,
  },
});
