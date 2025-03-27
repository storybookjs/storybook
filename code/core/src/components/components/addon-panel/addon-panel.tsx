import type { ReactElement } from 'react';
import React, { Component, useEffect, useRef } from 'react';

const usePrevious = (value: any) => {
  const ref = useRef();

  useEffect(() => {
    // happens after return
    ref.current = value;
  }, [value]);

  return ref.current;
};

const useUpdate = (update: boolean, value: any) => {
  const previousValue = usePrevious(value);

  return update ? value : previousValue;
};

interface AddonErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AddonErrorBoundary extends Component<{ children: ReactElement }, AddonErrorBoundaryState> {
  constructor(props: { children: ReactElement }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AddonErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '16px',
            fontFamily: 'sans-serif',
            color: '#333',
            backgroundColor: '#f8f8f8',
            border: '1px solid #e8e8e8',
            borderRadius: '4px',
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: '#e63244' }}>Addon Error</h3>
          <p style={{ margin: '0 0 8px' }}>
            This addon encountered an error. Other addons and stories remain accessible.
          </p>
          {this.state.error && (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
                fontSize: '12px',
                padding: '8px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '2px',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export interface AddonPanelProps {
  active: boolean;
  children: ReactElement;
}

export const AddonPanel = ({ active, children }: AddonPanelProps) => {
  return (
    // the hidden attribute is an valid html element that's both accessible and works to visually hide content
    <div hidden={!active}>
      <AddonErrorBoundary>{useUpdate(active, children)}</AddonErrorBoundary>
    </div>
  );
};
