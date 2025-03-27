// @vitest-environment happy-dom
/// <reference types="@testing-library/jest-dom" />;
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { Addon_BaseType } from 'storybook/internal/types';

import type { State } from 'storybook/manager-api';
// Import types enum to use correct panel type
import { types } from 'storybook/manager-api';

import { AddonPanel } from './Panel';

// Mock the layout provider context
vi.mock('../layout/LayoutProvider', () => ({
  useLayout: () => ({
    isDesktop: true,
    setMobilePanelOpen: vi.fn(),
  }),
}));

// Component that throws an error when rendered
const ErrorComponent = () => {
  throw new Error('Test error from addon');
};

// Create mock panels for testing
const createMockPanels = (includeErrorPanel = false): Record<string, Addon_BaseType> => {
  const panels: Record<string, Addon_BaseType> = {
    'normal-panel': {
      id: 'normal-panel',
      title: 'Normal Panel',
      type: types.PANEL,
      render: ({ active }) => <div data-testid="normal-addon-content">Normal Addon Content</div>,
    },
  };

  if (includeErrorPanel) {
    panels['error-panel'] = {
      id: 'error-panel',
      title: 'Error Panel',
      type: types.PANEL,
      render: ({ active }) => <ErrorComponent />,
    };
  }

  return panels;
};

// Mock actions and shortcuts
const mockActions = {
  onSelect: vi.fn(),
  togglePosition: vi.fn(),
  toggleVisibility: vi.fn(),
};

// Create a partial mock of shortcuts as we only use these properties in the test
const mockShortcuts = {
  panelPosition: 'P',
  togglePanel: 'A',
} as unknown as State['shortcuts'];

describe('AddonPanel', () => {
  it('renders panels normally', () => {
    render(
      <AddonPanel panels={createMockPanels()} actions={mockActions} shortcuts={mockShortcuts} />
    );

    expect(screen.getByTestId('normal-addon-content')).toBeInTheDocument();
    expect(screen.getByText('Normal Addon Content')).toBeInTheDocument();
  });

  it('catches errors from an addon and isolates the failure', () => {
    // Suppress console.error for this test to avoid noisy output
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AddonPanel
        panels={createMockPanels(true)}
        actions={mockActions}
        shortcuts={mockShortcuts}
        selectedPanel="error-panel"
      />
    );

    // The normal panel should still be accessible
    expect(screen.getByText('Normal Panel')).toBeInTheDocument();

    // Check if error UI is rendered for the error panel
    expect(screen.getByText('Addon Error')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This addon encountered an error. Other addons and stories remain accessible.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Test error from addon')).toBeInTheDocument();
  });
});
