import type { ComponentProps } from 'react';
import React, { useRef, useState } from 'react';

import { keyframes, styled } from 'storybook/theming';

const slideIn = keyframes({
  from: {
    transform: 'translateY(var(--slide-in-from))',
    opacity: 0,
  },
});

const slideOut = keyframes({
  to: {
    transform: 'translateY(var(--slide-out-to))',
    opacity: 0,
  },
});

const Container = styled.div({
  display: 'inline-grid',
  gridTemplateColumns: '1fr',
  justifyContent: 'center',
  alignItems: 'center',
});

const Placeholder = styled.div({
  gridArea: '1 / 1',
  userSelect: 'none',
  visibility: 'hidden',
});

const Text = styled.span<{
  duration: number;
  isExiting?: boolean;
  isEntering?: boolean;
  reverse?: boolean;
}>(({ duration, isExiting, isEntering, reverse }) => {
  let animation: string | undefined;

  if (isExiting) {
    animation = `${slideOut} ${duration}ms forwards`;
  } else if (isEntering) {
    animation = `${slideIn} ${duration}ms forwards`;
  }

  return {
    gridArea: '1 / 1',
    animation,
    pointerEvents: isExiting ? 'none' : 'auto',
    userSelect: isExiting ? 'none' : 'text',
    '--slide-in-from': reverse ? '-100%' : '100%',
    '--slide-out-to': reverse ? '100%' : '-100%',

    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      opacity: isExiting ? 0 : 1,
      transform: 'translateY(0)',
    },
  };
});

export const TextFlip = ({
  text,
  duration = 250,
  placeholder,
  ...props
}: {
  text: string;
  duration?: number;
  placeholder?: string;
} & ComponentProps<typeof Container>) => {
  const textRef = useRef(text);
  const [staleValue, setStaleValue] = useState(text);

  const isAnimating = text !== staleValue;
  const reverse = isAnimating && numericCompare(staleValue, text);

  textRef.current = text;

  return (
    <Container {...props}>
      {isAnimating && (
        <Text
          aria-hidden
          duration={duration}
          reverse={reverse}
          isExiting
          onAnimationEnd={() => setStaleValue(textRef.current)}
        >
          {staleValue}
        </Text>
      )}
      <Text duration={duration} reverse={reverse} isEntering={isAnimating}>
        {text}
      </Text>
      {placeholder && <Placeholder aria-hidden>{placeholder}</Placeholder>}
    </Container>
  );
};

function numericCompare(a: string, b: string): boolean {
  const na = Number(a);
  const nb = Number(b);
  return Number.isNaN(na) || Number.isNaN(nb)
    ? a.localeCompare(b, undefined, { numeric: true }) > 0
    : na > nb;
}
