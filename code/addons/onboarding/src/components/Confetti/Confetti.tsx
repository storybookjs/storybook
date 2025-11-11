import React, { type ComponentProps } from 'react';

import { Confetti as ReactConfetti } from '@neoconfetti/react';
import { styled } from 'storybook/theming';

const Wrapper = styled.div({
  zIndex: 9999,
  position: 'fixed',
  top: 0,
  left: '50%',
  width: '50%',
  height: '100%',
  pointerEvents: 'none',
});

export const Confetti = React.memo(function Confetti({
  colors = ['#CA90FF', '#FC521F', '#66BF3C', '#FF4785', '#FFAE00', '#1EA7FD'],
  ...confettiProps
}: ComponentProps<typeof ReactConfetti>) {
  return (
    <Wrapper>
      <ReactConfetti
        colors={colors}
        particleCount={200}
        duration={5000}
        stageHeight={window.innerHeight}
        stageWidth={window.innerWidth}
        destroyAfterDone
        {...confettiProps}
      />
    </Wrapper>
  );
});
