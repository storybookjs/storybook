import React from 'react';

import { keyframes, styled, transparentize } from '@storybook/core/theming';
import { LightningOffIcon } from '@storybook/icons';

import { rotate360 } from '../shared/animation';

const LoaderWrapper = styled.div<{ size?: number }>(({ size = 32 }) => ({
  borderRadius: '50%',
  cursor: 'progress',
  display: 'inline-block',
  overflow: 'hidden',
  position: 'absolute',
  transition: 'all 200ms ease-out',
  verticalAlign: 'top',
  top: '50%',
  left: '50%',
  marginTop: -(size / 2),
  marginLeft: -(size / 2),
  height: size,
  width: size,
  zIndex: 4,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: 'rgba(97, 97, 97, 0.29)',
  borderTopColor: 'rgb(100,100,100)',
  animation: `${rotate360} 0.7s linear infinite`,
  mixBlendMode: 'difference',
}));

const ProgressWrapper = styled.div({
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  height: '100%',
});

const ProgressTrack = styled.div(({ theme }) => ({
  position: 'relative',
  width: '80%',
  marginBottom: '0.75rem',
  maxWidth: 300,
  height: 5,
  borderRadius: 5,
  background: transparentize(0.8, theme.color.secondary),
  overflow: 'hidden',
  cursor: 'progress',
}));

const ProgressBar = styled.div(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  background: theme.color.secondary,
}));

const ProgressMessage = styled.div(({ theme }) => ({
  minHeight: '2em',
  fontSize: `${theme.typography.size.s1}px`,
  color: theme.barTextColor,
}));

const ErrorIcon = styled(LightningOffIcon)(({ theme }) => ({
  width: 20,
  height: 20,
  marginBottom: '0.5rem',
  color: theme.textMutedColor,
}));

const ellipsis = keyframes`
  from { content: "..." }
  33% { content: "." }
  66% { content: ".." }
  to { content: "..." }
`;

const Ellipsis = styled.span({
  '&::after': {
    content: "'...'",
    animation: `${ellipsis} 1s linear infinite`,
    animationDelay: '1s',
    display: 'inline-block',
    width: '1em',
    height: 'auto',
  },
});

interface Progress {
  value: number;
  message: string;
  modules?: {
    complete: number;
    total: number;
  };
}

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  progress?: Progress;
  error?: Error;
  size?: number;
}

export const Loader = ({ progress, error, size, ...props }: LoaderProps) => {
  if (error) {
    return (
      <ProgressWrapper aria-label={error.toString()} aria-live="polite" role="status" {...props}>
        <ErrorIcon />
        <ProgressMessage>{error.message}</ProgressMessage>
      </ProgressWrapper>
    );
  }

  if (progress) {
    const { value, modules } = progress;
    let { message } = progress;

    if (modules) {
      message += ` ${modules.complete} / ${modules.total} modules`;
    }
    return (
      <ProgressWrapper
        aria-label="Content is loading..."
        aria-live="polite"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value * 100}
        aria-valuetext={message}
        role="progressbar"
        {...props}
      >
        <ProgressTrack>
          <ProgressBar style={{ width: `${value * 100}%` }} />
        </ProgressTrack>
        <ProgressMessage>
          {message}
          {value < 1 && <Ellipsis key={message} />}
        </ProgressMessage>
      </ProgressWrapper>
    );
  }

  return (
    <LoaderWrapper
      aria-label="Content is loading..."
      aria-live="polite"
      role="status"
      size={size}
      {...props}
    />
  );
};
