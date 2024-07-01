import { ArrowRightIcon } from '@storybook/icons';
import { styled, keyframes } from '@storybook/theming';
import React, { useCallback, useEffect, useState } from 'react';

const fadeIn = keyframes({
  from: {
    opacity: 0,
  },
  to: {
    opacity: 1,
  },
});

const slideIn = keyframes({
  from: {
    transform: 'translate(0, -20px)',
    opacity: 0,
  },
  to: {
    transform: 'translate(0, 0)',
    opacity: 1,
  },
});

const scaleIn = keyframes({
  from: {
    opacity: 0,
    transform: 'scale(0.8)',
  },
  to: {
    opacity: 1,
    transform: 'scale(1)',
  },
});

const rotate = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '100%': {
    transform: 'rotate(360deg)',
  },
});

const Wrapper = styled.div<{ visible: boolean }>(({ visible }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  opacity: visible ? 1 : 0,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  transition: 'opacity 1s 0.5s',
}));

const Backdrop = styled.div({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  animation: `${fadeIn} 2s`,
  background: `
    radial-gradient(90% 90%, #ff4785 0%, #db5698 30%, #1ea7fdcc 100%),
    radial-gradient(circle, #ff4785 0%, transparent 80%),
    radial-gradient(circle at 30% 40%, #fc521f99 0%, #fc521f66 20%, transparent 40%),
    radial-gradient(circle at 75% 75%, #fc521f99 0%, #fc521f77 18%, transparent 30%)`,
  '&::before': {
    opacity: 0.5,
    background: `
      radial-gradient(circle at 30% 40%, #fc521f99 0%, #fc521f66 10%, transparent 20%),
      radial-gradient(circle at 75% 75%, #fc521f99 0%, #fc521f77 8%, transparent 20%)`,
    content: '""',
    position: 'absolute',
    top: '-50vw',
    left: '-50vh',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100vw + 100vh)',
    height: 'calc(100vw + 100vh)',
    animation: `${rotate} 12s linear infinite`,
  },
});

const Content = styled.div<{ visible: boolean }>(({ visible }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  color: 'white',
  textAlign: 'center',
  maxWidth: 400,
  opacity: visible ? 1 : 0,
  transition: 'opacity 0.5s',

  h1: {
    fontSize: 45,
    fontWeight: 'bold',
    animation: `${slideIn} 1.5s 1s backwards`,
  },
}));

const RadialButton = styled.button({
  display: 'inline-flex',
  position: 'relative',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 40,
  width: 48,
  height: 48,
  padding: 0,
  borderRadius: '50%',
  border: 0,
  outline: 'none',
  background: 'rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  transition: 'background 0.2s',
  animation: `${scaleIn} 1.5s 1.5s backwards`,

  '&:hover, &:focus': {
    background: 'rgba(255, 255, 255, 0.4)',
  },
});

const ArrowIcon = styled(ArrowRightIcon)({
  width: 30,
  color: 'white',
});

const ProgressCircle = styled.svg<{ progress?: boolean; spinner?: boolean }>(({ progress }) => ({
  position: 'absolute',
  top: -1,
  left: -1,
  width: `50px!important`,
  height: `50px!important`,
  transform: 'rotate(-90deg)',
  color: 'white',
  circle: {
    r: '24',
    cx: '25',
    cy: '25',
    fill: 'transparent',
    stroke: progress ? 'currentColor' : 'transparent',
    strokeWidth: '1',
    strokeLinecap: 'round',
    strokeDasharray: Math.PI * 48,
  },
}));

interface SplashScreenProps {
  onDismiss: () => void;
}

export const SplashScreen = ({ onDismiss }: SplashScreenProps) => {
  const [progress, setProgress] = useState(-30);
  const [visible, setVisible] = useState(true);
  const ready = progress >= 100;

  const dismiss = useCallback(() => {
    setVisible(false);
    const timeout = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timeout);
  }, [onDismiss]);

  useEffect(() => {
    const interval = setInterval(() => setProgress((prev) => prev + 0.5), 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (ready) dismiss();
  }, [ready, dismiss]);

  return (
    <Wrapper visible={visible}>
      <Backdrop />
      <Content visible={visible}>
        <h1>Meet your new frontend workshop</h1>
        <RadialButton onClick={dismiss}>
          <ArrowIcon />
          <ProgressCircle xmlns="http://www.w3.org/2000/svg">
            <circle />
          </ProgressCircle>
          <ProgressCircle xmlns="http://www.w3.org/2000/svg" progress>
            <circle
              strokeDashoffset={Math.PI * 48 * (1 - Math.max(0, Math.min(progress, 100)) / 100)}
            />
          </ProgressCircle>
        </RadialButton>
      </Content>
    </Wrapper>
  );
};
