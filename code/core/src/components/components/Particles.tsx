import type { ComponentProps } from 'react';
import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { keyframes, styled } from 'storybook/theming';

const Shape = styled.svg(({ color }) => ({
  fill: color,
  position: 'absolute',
  inset: '0',
  margin: 'auto',
  width: '12px',
  height: '12px',
  pointerEvents: 'none',
}));

const Donut = (props: ComponentProps<typeof Shape>) => (
  <Shape viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" color="red" {...props}>
    <path d="M45 0c24.853 0 45 20.147 45 45S69.853 90 45 90 0 69.853 0 45 20.147 0 45 0zm.5 27C35.283 27 27 35.283 27 45.5S35.283 64 45.5 64 64 55.717 64 45.5 55.717 27 45.5 27z" />
  </Shape>
);

const L = (props: ComponentProps<typeof Shape>) => (
  <Shape viewBox="0 0 55 89" xmlns="http://www.w3.org/2000/svg" color="#66BF3C" {...props}>
    <path d="M55 3v83a3 3 0 01-3 3H3a3 3 0 01-3-3V64a3 3 0 013-3h21a3 3 0 003-3V3a3 3 0 013-3h22a3 3 0 013 3z" />
  </Shape>
);

const Slice = (props: ComponentProps<typeof Shape>) => (
  <Shape viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg" color="#FF4785" {...props}>
    <path d="M92 89V3c0-3-2.056-3-3-3C39.294 0 0 39.294 0 89c0 0 0 3 3 3h86a3 3 0 003-3z" />
  </Shape>
);

const Square = ({ style, ...props }: ComponentProps<typeof Shape>) => (
  <Shape
    viewBox="0 0 90 90"
    xmlns="http://www.w3.org/2000/svg"
    color="#1EA7FD"
    {...props}
    style={{ borderRadius: 5, ...style }}
  >
    <path d="M0 0h90v90H0z" />
  </Shape>
);

const Triangle = (props: ComponentProps<typeof Shape>) => (
  <Shape viewBox="0 0 96 88" xmlns="http://www.w3.org/2000/svg" color="#FFAE00" {...props}>
    <path d="M50.63 1.785l44.928 81.77A3 3 0 0192.928 88H3.072a3 3 0 01-2.629-4.445l44.929-81.77a3 3 0 015.258 0z" />
  </Shape>
);

const T = (props: ComponentProps<typeof Shape>) => (
  <Shape viewBox="0 0 92 62" xmlns="http://www.w3.org/2000/svg" color="#FC521F" {...props}>
    <path d="M63 3v25a3 3 0 003 3h23a3 3 0 013 3v25a3 3 0 01-3 3H3a3 3 0 01-3-3V34a3 3 0 013-3h24a3 3 0 003-3V3a3 3 0 013-3h27a3 3 0 013 3z" />
  </Shape>
);

const Z = (props: ComponentProps<typeof Shape>) => (
  <Shape viewBox="0 0 56 90" xmlns="http://www.w3.org/2000/svg" color="#6F2CAC" {...props}>
    <path d="M28 3v25a3 3 0 003 3h22a3 3 0 013 3v53a3 3 0 01-3 3H31a3 3 0 01-3-3V62a3 3 0 00-3-3H3a3 3 0 01-3-3V3a3 3 0 013-3h22a3 3 0 013 3z" />
  </Shape>
);

const fadeToTransparent = keyframes`
  to {
    opacity: 0;
  }
`;

const disperse = keyframes`
  to {
    transform: translate(
      calc(cos(var(--angle)) * var(--distance)),
      calc(sin(var(--angle)) * var(--distance))
    ) rotate(var(--rotation));
  }
`;

const slideDown = keyframes`
  to {
    transform: translateY(50px);
  }
`;

const Container = styled.div({
  position: 'absolute',
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  '--particle-curve': 'cubic-bezier(0.2, 0.56, 0, 1)',
  animation: `${slideDown} 1000ms forwards cubic-bezier(0.587, -0.381, 0.583, 0.599)`,
  animationDelay: '150ms',
  zIndex: 999,

  svg: {
    width: 15,
    height: 15,
    animation: `${fadeToTransparent} var(--fade-duration) forwards, ${disperse} 1000ms forwards var(--particle-curve)`,
  },
});

const FADE_DURATION = 1200;
const NUM_OF_PARTICLES = 8;
// `JITTER` is the amount of variance allowed for each angle.
// Tweak this value to control how orderly/chaotic the animation appears.
const JITTER = 15;

const random = (min: number, max: number) => Math.random() * (max - min) + min;
const sortRandomly = (array: any[]) => array.sort(() => Math.random() - 0.5);

export const Particles = memo(function Particles({
  anchor: Anchor,
}: {
  anchor: React.ElementType;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);

  const shapes = sortRandomly([Donut, L, Slice, Square, Triangle, T, Z]);
  const colors = sortRandomly([
    '#FF0000',
    '#FF4787',
    '#66BF3C',
    '#1EA7FD',
    '#FC521F',
    '#6F2CAC',
    '#FFAE00',
  ]);

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      setLeft(rect.left + rect.width / 2);
      setTop(rect.top + rect.height / 2);
    }
  }, []);

  return (
    <div ref={anchorRef}>
      <Anchor />
      {createPortal(
        <Container style={{ top: top + 'px', left: left + 'px' }}>
          {shapes.map((Particle, index) => {
            const angle = (360 / NUM_OF_PARTICLES) * index + random(-JITTER, JITTER);
            const distance = random(50, 80);
            const rotation = random(-360, 360);

            const style = {
              '--angle': angle + 'deg',
              '--distance': distance + 'px',
              '--rotation': rotation + 'deg',
              '--fade-duration': FADE_DURATION + 'ms',
            } as React.CSSProperties;

            return <Particle key={Particle.name} style={style} color={colors[index]} />;
          })}
        </Container>,
        document.getElementById('root') ?? document.body
      )}
    </div>
  );
});
