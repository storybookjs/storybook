import type { ReactNode } from 'react';
import React, { Component } from 'react';

import { styled } from 'storybook/theming';

import { ErrorState } from '../State/ErrorState.tsx';

interface TabErrorBoundaryProps {
  children: ReactNode;
  active?: boolean;
}

const Fallback = styled.div(({ theme }) => ({
  height: '100%',
  display: 'flex',
  padding: 30,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 15,
  background: theme.background.content,
}));

/** Single error boundary for addon panel tabs; the deprecated `Tabs` and the addon panel both render through it. */
export class TabErrorBoundary extends Component<TabErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error rendering addon panel');
    console.error(error);
    console.error(info.componentStack);
  }

  render() {
    const { active = true, children } = this.props;
    const { hasError } = this.state;
    if (hasError && active) {
      return (
        <Fallback>
          <ErrorState
            severity="negative"
            title="Addon panel failed to render"
            summary="An error in this addon prevented the panel from rendering. Check the browser console for more details."
            showBadge={false}
          />
        </Fallback>
      );
    }

    return children;
  }
}
