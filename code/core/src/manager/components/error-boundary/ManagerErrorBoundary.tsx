import type { ReactNode } from 'react';
import React, { Component } from 'react';

import { Badge, Button, Collapsible } from 'storybook/internal/components';

import { SyncIcon, UnfoldIcon } from '@storybook/icons';

import { transparentize } from 'polished';
import { styled } from 'storybook/theming';

const Container = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100vw',
  height: '100vh',
  backgroundColor: theme.background.app,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const Content = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  width: '80%',
  height: '80%',
  padding: 20,
  gap: 20,
  backgroundColor: theme.background.content,
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.color.negative}`,
  boxShadow: '0 0 64px rgba(0, 0, 0, 0.1)',
  overflow: 'auto',
}));

const Info = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: 15,
}));

const Heading = styled.h1(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  margin: 0,
  gap: 10,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
}));

const SubHeading = styled.p(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.textMutedColor,
  margin: 0,
  lineHeight: 1.4,
  textWrap: 'balance',
}));

const ErrorWrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column-reverse',
  width: '100%',
  flex: '0 0 auto',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  pre: {
    borderRadius: 0,
  },
}));

const CollapseToggle = styled.div(({ theme }) => ({
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 40,
  width: '100%',
  padding: '0 10px',
  cursor: 'pointer',
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
  userSelect: 'none',
  '&:hover': {
    backgroundColor: theme.base === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.03)',
  },
  svg: {
    color: theme.textMutedColor,
  },
}));

const ErrorMessage = styled.pre(({ theme }) => ({
  order: 1,
  padding: '11px 15px',
  margin: 0,
  fontSize: theme.typography.size.s1,
  color: theme.color.negativeText,
  backgroundColor: transparentize(theme.base === 'light' ? 0.95 : 0.9, theme.color.negative),
  borderBottom: `1px solid ${theme.appBorderColor}`,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: theme.typography.fonts.mono,
  lineHeight: '18px',
}));

const ErrorStack = styled.pre(({ theme }) => ({
  padding: 15,
  margin: 0,
  fontSize: theme.typography.size.s1,
  color: theme.textMutedColor,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  borderRadius: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: theme.typography.fonts.mono,
}));

interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
}

const ErrorFallback = ({ error, errorInfo }: ErrorFallbackProps) => {
  return (
    <Container data-testid="manager-error-boundary">
      <Content>
        <Info>
          <Heading>
            <Badge status="negative">Error</Badge>
            <span>Something went wrong</span>
          </Heading>
          <SubHeading>
            The Storybook Manager UI encountered an error. This is usually caused by custom addon
            code or configuration. Please check your browser console for more details. Try clearing
            browser storage if the issue persists.
          </SubHeading>
          <Button asChild size="medium">
            <a href={window.location.origin + window.location.pathname}>
              <SyncIcon size={14} />
              Reload Storybook
            </a>
          </Button>
        </Info>
        <ErrorWrapper>
          <ErrorMessage>{error.message || 'Unknown error'}</ErrorMessage>
          <Collapsible
            collapsed={true}
            summary={({ isCollapsed, toggleCollapsed }) => (
              <CollapseToggle onClick={toggleCollapsed}>
                <UnfoldIcon />
                {isCollapsed ? 'Expand error' : 'Collapse error'}
              </CollapseToggle>
            )}
          >
            {(error.stack || errorInfo?.componentStack) && (
              <ErrorStack>
                {error.stack}
                {errorInfo?.componentStack && `\n\nComponent Stack:${errorInfo.componentStack}`}
              </ErrorStack>
            )}
          </Collapsible>
        </ErrorWrapper>
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
