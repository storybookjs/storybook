import type { ReactNode } from 'react';
import React, { Component } from 'react';

import { StorybookLogo } from 'storybook/internal/components';

import { AlertIcon, SyncIcon } from '@storybook/icons';

import { keyframes, styled, useTheme } from 'storybook/theming';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(20px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const Container = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: 40,
  backgroundColor: theme.background.app,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
  animation: `${fadeIn} 0.3s ease-out`,
}));

const Content = styled.div({
  maxWidth: 480,
  textAlign: 'center',
});

const IconWrapper = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 80,
  height: 80,
  borderRadius: '50%',
  backgroundColor: theme.base === 'light' ? 'rgba(255, 71, 71, 0.1)' : 'rgba(255, 71, 71, 0.2)',
  marginBottom: 24,
  margin: '0 auto 24px',
}));

const Heading = styled.h1(({ theme }) => ({
  fontSize: theme.typography.size.l1,
  fontWeight: theme.typography.weight.bold,
  margin: '0 0 12px',
  color: theme.color.defaultText,
}));

const SubHeading = styled.p(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.color.mediumdark,
  margin: '0 0 24px',
  lineHeight: 1.5,
}));

const ErrorDetails = styled.details(({ theme }) => ({
  width: '100%',
  marginTop: 24,
  textAlign: 'left',
  backgroundColor: theme.base === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.appBorderColor}`,
  overflow: 'hidden',
}));

const ErrorSummary = styled.summary(({ theme }) => ({
  padding: '12px 16px',
  cursor: 'pointer',
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
  userSelect: 'none',
  '&:hover': {
    backgroundColor: theme.base === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.03)',
  },
}));

const ErrorMessage = styled.pre(({ theme }) => ({
  padding: 16,
  margin: 0,
  fontSize: theme.typography.size.s1,
  color: theme.color.negative,
  backgroundColor: theme.base === 'light' ? 'rgba(255, 71, 71, 0.05)' : 'rgba(255, 71, 71, 0.1)',
  borderTop: `1px solid ${theme.appBorderColor}`,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: theme.typography.fonts.mono,
  maxHeight: 300,
}));

const ErrorStack = styled.pre(({ theme }) => ({
  padding: 16,
  margin: 0,
  fontSize: theme.typography.size.s1,
  color: theme.color.mediumdark,
  backgroundColor: theme.base === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
  borderTop: `1px solid ${theme.appBorderColor}`,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: theme.typography.fonts.mono,
  maxHeight: 300,
}));

const Button = styled.button(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.lightest,
  backgroundColor: theme.color.secondary,
  border: 'none',
  borderRadius: theme.appBorderRadius,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme.base === 'light' ? '#0b5eb5' : '#4ba2ff',
  },
  '&:focus': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.color.secondary}40`,
  },
}));

const LogoWrapper = styled.div({
  marginBottom: 32,
  '& svg': {
    height: 40,
    width: 'auto',
  },
});

interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
}

const ErrorFallback = ({ error, errorInfo }: ErrorFallbackProps) => {
  const theme = useTheme();

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Container data-testid="manager-error-boundary">
      <Content>
        <LogoWrapper>
          <StorybookLogo />
        </LogoWrapper>
        <IconWrapper>
          <AlertIcon size={32} color={theme.color.negative} />
        </IconWrapper>
        <Heading>Something went wrong</Heading>
        <SubHeading>
          The Storybook Manager UI encountered an error. This is usually caused by custom addon code
          or configuration. Please check your browser console for more details.
        </SubHeading>
        <Button onClick={handleReload}>
          <SyncIcon size={14} />
          Reload Storybook
        </Button>
        <ErrorDetails>
          <ErrorSummary>Error details</ErrorSummary>
          <ErrorMessage>{error.message || 'Unknown error'}</ErrorMessage>
          {(error.stack || errorInfo?.componentStack) && (
            <ErrorStack>
              {error.stack}
              {errorInfo?.componentStack && `\nComponent Stack:${errorInfo.componentStack}`}
            </ErrorStack>
          )}
        </ErrorDetails>
      </Content>
    </Container>
  );
};

interface ManagerErrorBoundaryProps {
  children: ReactNode;
}

interface ManagerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ManagerErrorBoundary extends Component<
  ManagerErrorBoundaryProps,
  ManagerErrorBoundaryState
> {
  constructor(props: ManagerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ManagerErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console for debugging
    console.error('Storybook Manager UI Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children } = this.props;

    if (hasError && error) {
      return <ErrorFallback error={error} errorInfo={errorInfo} />;
    }

    return children;
  }
}
