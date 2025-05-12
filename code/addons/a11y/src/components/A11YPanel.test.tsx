// @vitest-environment happy-dom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import * as managerApi from 'storybook/manager-api';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { type EnhancedResults } from '../types';
import { A11YPanel } from './A11YPanel';
import { type A11yContextStore, useA11yContext } from './A11yContext';

vi.mock('storybook/manager-api');
const mockedManagerApi = vi.mocked(managerApi);

vi.mock('./A11yContext');
const mockedUseA11yContext = vi.mocked(useA11yContext);

mockedManagerApi.useParameter.mockReturnValue({
  manual: false,
} as any);

const emptyResults: EnhancedResults = {
  passes: [],
  incomplete: [],
  violations: [],
  toolOptions: {},
  inapplicable: [],
  testEngine: { name: '', version: '' },
  testRunner: { name: '' },
  testEnvironment: { userAgent: '', windowWidth: 0, windowHeight: 0 },
  url: '',
  timestamp: '',
};

describe('A11YPanel', () => {
  it('should render initializing state', () => {
    mockedUseA11yContext.mockReturnValue({
      parameters: {},
      results: emptyResults,
      status: 'initial',
      handleManual: vi.fn(),
      error: null,
    } as Partial<A11yContextStore> as any);

    const element = render(
      <ThemeProvider theme={convert(themes.light)}>
        <A11YPanel />
      </ThemeProvider>
    );

    expect(element.getByText('Please wait while the addon is initializing...')).toBeInTheDocument();
  });

  it('should render manual state', () => {
    const handleManual = vi.fn();
    mockedUseA11yContext.mockReturnValue({
      parameters: {},
      results: emptyResults,
      status: 'manual',
      handleManual,
      error: null,
    } as Partial<A11yContextStore> as any);

    const component = render(
      <ThemeProvider theme={convert(themes.light)}>
        <A11YPanel />
      </ThemeProvider>
    );

    const runTestButton = component.getByText('Run accessibility scan');
    expect(runTestButton).toBeInTheDocument();

    fireEvent.click(runTestButton);
    expect(handleManual).toHaveBeenCalled();
  });

  it('should render running state', () => {
    mockedUseA11yContext.mockReturnValue({
      parameters: {},
      results: emptyResults,
      status: 'running',
      handleManual: vi.fn(),
      error: null,
    } as Partial<A11yContextStore> as any);

    const component = render(
      <ThemeProvider theme={convert(themes.light)}>
        <A11YPanel />
      </ThemeProvider>
    );

    expect(
      component.getByText('Please wait while the accessibility scan is running...')
    ).toBeInTheDocument();
  });

  it('should render error state', () => {
    mockedUseA11yContext.mockReturnValue({
      parameters: {},
      results: emptyResults,
      status: 'error',
      handleManual: vi.fn(),
      error: 'Test error message',
    } as Partial<A11yContextStore> as any);

    const component = render(
      <ThemeProvider theme={convert(themes.light)}>
        <A11YPanel />
      </ThemeProvider>
    );

    expect(component.container).toHaveTextContent('The accessibility scan encountered an error');
    expect(component.container).toHaveTextContent('Test error message');
  });

  it('should render error state with object error', () => {
    mockedUseA11yContext.mockReturnValue({
      parameters: {},
      results: emptyResults,
      status: 'error',
      handleManual: vi.fn(),
      error: { message: 'Test error object message' },
    } as Partial<A11yContextStore> as any);

    const component = render(
      <ThemeProvider theme={convert(themes.light)}>
        <A11YPanel />
      </ThemeProvider>
    );

    expect(component.container).toHaveTextContent('The accessibility scan encountered an error');
    expect(component.container).toHaveTextContent(`{ "message": "Test error object message" }`);
  });
});
