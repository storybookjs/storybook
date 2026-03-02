// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { LiveRegion } from './LiveRegion';
import { toHaveLiveRegion } from './toHaveLiveRegion';

expect.extend({ toHaveLiveRegion });

describe('LiveRegion', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with role="status" and aria-live="polite" by default', () => {
    render(<LiveRegion>Hello</LiveRegion>);
    const el = screen.getByRole('status');
    expect(el).toBeDefined();
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.textContent).toBe('Hello');
  });

  it('renders with aria-live="assertive" when politeness is assertive', () => {
    render(<LiveRegion politeness="assertive">Alert!</LiveRegion>);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });

  it('applies sb-sr-only class when visuallyHidden is true (default)', () => {
    render(<LiveRegion>Hidden text</LiveRegion>);
    const el = screen.getByRole('status');
    expect(el.className).toContain('sb-sr-only');
  });

  it('does not apply sb-sr-only class when visuallyHidden is false', () => {
    render(<LiveRegion visuallyHidden={false}>Visible text</LiveRegion>);
    const el = screen.getByRole('status');
    expect(el.className).not.toContain('sb-sr-only');
  });

  it('merges className with sb-sr-only when visuallyHidden is true', () => {
    render(<LiveRegion className="custom">Content</LiveRegion>);
    const el = screen.getByRole('status');
    expect(el.className).toContain('sb-sr-only');
    expect(el.className).toContain('custom');
  });

  it('passes through additional HTML attributes', () => {
    render(
      <LiveRegion id="my-region" data-testid="live">
        Content
      </LiveRegion>
    );
    const el = screen.getByTestId('live');
    expect(el.id).toBe('my-region');
  });

  it('renders children correctly', () => {
    render(
      <LiveRegion visuallyHidden={false}>
        <span>Child element</span>
      </LiveRegion>
    );
    expect(screen.getByText('Child element')).toBeDefined();
  });
});

describe('toHaveLiveRegion', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes when a matching live region is found', () => {
    const { container } = render(<LiveRegion visuallyHidden={false}>Tests passed</LiveRegion>);
    expect(container).toHaveLiveRegion({ text: 'Tests passed' });
  });

  it('fails when no matching live region is found', () => {
    const { container } = render(<LiveRegion visuallyHidden={false}>Tests passed</LiveRegion>);
    expect(() => {
      expect(container).toHaveLiveRegion({ text: 'Tests failed' });
    }).toThrow();
  });

  it('matches with RegExp', () => {
    const { container } = render(
      <LiveRegion visuallyHidden={false}>3 tests passed, 0 failed</LiveRegion>
    );
    expect(container).toHaveLiveRegion({ text: /\d+ tests passed/ });
  });

  it('filters by politeness level', () => {
    const { container } = render(
      <LiveRegion politeness="assertive" visuallyHidden={false}>
        Error occurred
      </LiveRegion>
    );
    expect(container).toHaveLiveRegion({ text: 'Error occurred', level: 'assertive' });
    expect(() => {
      expect(container).toHaveLiveRegion({ text: 'Error occurred', level: 'polite' });
    }).toThrow();
  });

  it('works with .not modifier', () => {
    const { container } = render(<LiveRegion visuallyHidden={false}>Tests passed</LiveRegion>);
    expect(container).not.toHaveLiveRegion({ text: 'Tests failed' });
  });
});
