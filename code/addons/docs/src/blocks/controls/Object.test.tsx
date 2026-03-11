// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { ObjectControl } from './Object';

const renderObjectControl = () => {
  const onChange = vi.fn();

  render(
    <ThemeProvider theme={convert(themes.light)}>
      <ObjectControl name="object" value={{ label: 'value' }} onChange={onChange} />
    </ThemeProvider>
  );

  return { onChange };
};

describe('ObjectControl accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('adds an aria description to the raw editor toggle button', () => {
    renderObjectControl();

    const editAsJsonButton = screen.getByRole('button', { name: 'Edit object as JSON' });
    expect(editAsJsonButton.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('renders the raw JSON textarea with a label and announces parse errors', () => {
    const { onChange } = renderObjectControl();

    fireEvent.click(screen.getByRole('button', { name: 'Edit object as JSON' }));

    const rawInput = screen.getByLabelText('Edit object as JSON');
    fireEvent.change(rawInput, { target: { value: '{"label":' } });
    fireEvent.blur(rawInput);

    const parseError = screen.getByRole('status');
    expect(parseError.textContent).toContain('Invalid JSON');
    expect(rawInput.getAttribute('aria-invalid')).toBe('true');
    expect(rawInput.getAttribute('aria-describedby')).toBe(parseError.getAttribute('id'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(rawInput, { target: { value: '{"label":"updated"}' } });
    fireEvent.blur(rawInput);

    expect(screen.queryByRole('status')).toBeNull();
    expect(rawInput.getAttribute('aria-invalid')).toBe('false');
    expect(rawInput.getAttribute('aria-describedby')).toBeNull();
    expect(onChange).toHaveBeenCalledWith({ label: 'updated' });
  });

  it('clears parse errors after closing and reopening the raw JSON editor', () => {
    renderObjectControl();

    const editAsJsonButton = screen.getByRole('button', { name: 'Edit object as JSON' });

    fireEvent.click(editAsJsonButton);

    let rawInput = screen.getByLabelText('Edit object as JSON');
    fireEvent.change(rawInput, { target: { value: '{"label":' } });
    fireEvent.blur(rawInput);

    expect(screen.getByRole('status').textContent).toContain('Invalid JSON');
    expect(rawInput.getAttribute('aria-invalid')).toBe('true');

    fireEvent.click(editAsJsonButton);
    fireEvent.click(editAsJsonButton);

    rawInput = screen.getByLabelText('Edit object as JSON');
    expect(screen.queryByRole('status')).toBeNull();
    expect(rawInput.getAttribute('aria-invalid')).toBe('false');
    expect(rawInput.getAttribute('aria-describedby')).toBeNull();
  });
});
