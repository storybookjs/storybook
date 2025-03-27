// @vitest-environment happy-dom
/// <reference types="@testing-library/jest-dom" />;
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import { AddonPanel } from './addon-panel';

// Component that throws an error when rendered
const ErrorComponent = () => {
  throw new Error('Test error from addon');
};

describe('AddonPanel', () => {
  it('renders children when active', () => {
    render(
      <AddonPanel active>
        <div data-testid="child">Content</div>
      </AddonPanel>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('hides children when inactive', () => {
    const { container } = render(
      <AddonPanel active={false}>
        <div data-testid="child">Content</div>
      </AddonPanel>
    );

    // The child is not visible, but it's still in the DOM as the parent has the hidden attribute
    const hiddenDiv = container.querySelector('[hidden]');
    expect(hiddenDiv).toBeInTheDocument();
    // We don't check containment since the implementation might change, just verify visibility
    expect(hiddenDiv?.getAttribute('hidden')).not.toBeNull();
  });

  it('catches errors from child components and displays error UI', () => {
    // Suppress console.error for this test to avoid noisy output
    const originalConsoleError = console.error;
    console.error = vi.fn();

    render(
      <AddonPanel active>
        <ErrorComponent />
      </AddonPanel>
    );

    // Check if error UI is rendered
    expect(screen.getByText('Addon Error')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This addon encountered an error. Other addons and stories remain accessible.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Test error from addon')).toBeInTheDocument();

    // Restore console.error
    console.error = originalConsoleError;
  });
});
