import type { Keyframes, SerializedStyles } from '@emotion/react';
import { css, keyframes } from '@emotion/react';

export const easing = {
  rubber: 'cubic-bezier(0.175, 0.885, 0.335, 1.05)',
};

const rotate360: Keyframes = keyframes`
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
`;

const glow: Keyframes = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
`;

const float: Keyframes = keyframes`
  0% { transform: translateY(1px); }
  25% { transform: translateY(0px); }
  50% { transform: translateY(-3px); }
  100% { transform: translateY(1px); }
`;

const jiggle: Keyframes = keyframes`
  0%, 100% { transform:translate3d(0,0,0); }
  12.5%, 62.5% { transform:translate3d(-4px,0,0); }
  37.5%, 87.5% {  transform: translate3d(4px,0,0);  }
`;

const inlineGlow: SerializedStyles = css`
  animation: ${glow} 1.5s ease-in-out infinite;
  color: transparent;
  cursor: progress;
`;

// hover & active state for links and buttons
const hoverable: SerializedStyles = css`
  transition: all 150ms ease-out;
  transform: translate3d(0, 0, 0);

  &:hover {
    transform: translate3d(0, -2px, 0);
  }

  &:active {
    transform: translate3d(0, 0, 0);
  }
`;

export const animation = {
  rotate360,
  glow,
  float,
  jiggle,
  inlineGlow,
  hoverable,
} as const;
