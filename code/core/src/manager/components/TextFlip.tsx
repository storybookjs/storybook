import React, { useEffect, useRef, useState } from 'react';

import { styled } from 'storybook/theming';

import { Transition } from './Transition';

const Container = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr',
});

const Placeholder = styled.div({
  gridArea: '1 / 1',
  userSelect: 'none',
  visibility: 'hidden',
});

const Line = styled.div<{ duration: number }>(({ 'aria-hidden': ariaHidden, duration }) => ({
  gridArea: '1 / 1',
  transform: `translateY(0)`,
  userSelect: ariaHidden ? 'none' : 'text',

  '&.old-exit-active': {
    transition: `all ${duration}ms ease-in-out`,
    transform: 'translateY(-100%)',
    opacity: 0,
  },
  '&.old-reverse-exit-active': {
    transition: `all ${duration}ms ease-in-out`,
    transform: 'translateY(100%)',
    opacity: 0,
  },
  '&.new-enter': {
    transform: `translateY(100%)`,
    opacity: 0,
  },
  '&.new-enter-active': {
    transition: `all ${duration}ms ease-in-out`,
    transform: `translateY(0)`,
    opacity: 1,
  },
  '&.new-reverse-enter': {
    transform: `translateY(-100%)`,
    opacity: 0,
  },
  '&.new-reverse-enter-active': {
    transition: `all ${duration}ms ease-in-out`,
    transform: `translateY(0)`,
    opacity: 1,
  },
}));

export const TextFlip = ({
  text,
  duration = 250,
  placeholder,
  ...props
}: {
  text: string;
  duration?: number;
  placeholder?: string;
}) => {
  const oldRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const [staleValue, setStaleValue] = useState(text);
  const [updatedValue, setUpdatedValue] = useState(text);
  const reverse = staleValue.localeCompare(text, undefined, { numeric: true }) > 0;

  useEffect(() => {
    setUpdatedValue(text);
    const timeout = setTimeout(() => setStaleValue(text), duration);
    return () => clearTimeout(timeout);
  }, [text, duration]);

  return (
    <Container {...props}>
      <Transition
        in={updatedValue === text}
        nodeRef={newRef}
        timeout={duration}
        classNames={reverse ? 'new-reverse' : 'new'}
      >
        <Line duration={duration} ref={newRef}>
          {text}
        </Line>
      </Transition>
      <Transition
        in={updatedValue !== text}
        nodeRef={oldRef}
        timeout={duration}
        classNames={reverse ? 'old-reverse' : 'old'}
      >
        <Line duration={duration} ref={oldRef} aria-hidden>
          {staleValue}
        </Line>
      </Transition>
      {placeholder && <Placeholder aria-hidden>{placeholder}</Placeholder>}
    </Container>
  );
};
