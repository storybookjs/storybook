// @vitest-environment happy-dom
import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { ObjectControl } from './Object';

describe('Object control', () => {
  it('renders function values without crashing', () => {
    const onChange = vi.fn();

    render(
      <ThemeProvider theme={convert(themes.light)}>
        <ObjectControl
          name="object"
          storyId="story--function"
          value={vi.fn()}
          onChange={onChange}
        />
      </ThemeProvider>
    );

    const rawInput = screen.getByRole('textbox', { name: 'Edit object as JSON' });

    expect((rawInput as HTMLTextAreaElement).value).toBe('');
  });
});
