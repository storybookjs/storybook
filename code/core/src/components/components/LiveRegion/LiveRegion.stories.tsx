import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent } from 'storybook/test';

import { LiveRegion } from './LiveRegion';

const meta = {
  component: LiveRegion,
  tags: ['autodocs'],
} satisfies Meta<typeof LiveRegion>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default `LiveRegion` is visually hidden but still announced by screen readers. Inspect the
 * DOM to see the rendered `aria-live` region.
 */
export const Default: Story = {
  args: {
    children: 'Content loaded successfully.',
    politeness: 'polite',
  },
};

/**
 * A visible live region renders on-screen. This is useful for form validation messages that should
 * be both visible and announced.
 */
export const Visible: Story = {
  args: {
    children: 'Please enter a valid email address.',
    visuallyHidden: false,
    politeness: 'polite',
    style: { color: 'red', fontSize: 14 },
  },
};

/** An assertive live region interrupts the user immediately rather than waiting for an idle moment. */
export const Assertive: Story = {
  args: {
    children: 'Error: connection lost!',
    politeness: 'assertive',
  },
};

/** Demonstrates dynamic content updates announced via the live region. */
export const DynamicUpdates: Story = {
  render: (args) => {
    const [message, setMessage] = useState('Idle');
    return (
      <div>
        <button onClick={() => setMessage(`Tests passed at ${new Date().toLocaleTimeString()}`)}>
          Run tests
        </button>
        <button onClick={() => setMessage('Idle')}>Reset</button>

        {/* Visible copy for sighted users */}
        <p data-testid="status-display">Status: {message}</p>

        {/* Announced live region */}
        <LiveRegion {...args}>{message}</LiveRegion>
      </div>
    );
  },
  args: {
    politeness: 'polite',
  },
  play: async ({ canvas }) => {
    // Verify initial state
    const statusDisplay = canvas.getByTestId('status-display');
    await expect(statusDisplay).toHaveTextContent('Status: Idle');

    // Click the "Run tests" button to update the live region
    const runButton = canvas.getByRole('button', { name: 'Run tests' });
    await userEvent.click(runButton);

    // Verify the status updated
    await expect(statusDisplay).toHaveTextContent('Status: Tests passed at');

    // Verify the live region element exists with correct attributes
    const liveRegion = canvas.getByRole('status');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    await expect(liveRegion).toHaveTextContent(/Tests passed at/);
  },
};

/**
 * A visible live region used for form-style error messages. The region is visible on screen _and_
 * announced by assistive technology.
 */
export const VisibleFormError: Story = {
  render: (args) => {
    const [error, setError] = useState('');
    return (
      <div>
        <label htmlFor="email-input">Email</label>
        <input
          id="email-input"
          type="email"
          aria-describedby="email-error"
          onBlur={(e) => {
            if (!e.target.value.includes('@')) {
              setError('Please enter a valid email address.');
            } else {
              setError('');
            }
          }}
        />
        <LiveRegion {...args} id="email-error" visuallyHidden={false} style={{ color: 'red' }}>
          {error}
        </LiveRegion>
      </div>
    );
  },
  args: {
    politeness: 'assertive',
  },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Email');
    const liveRegion = canvas.getByRole('status');

    // Type an invalid email and blur
    await userEvent.type(input, 'invalid');
    await userEvent.tab();

    // Verify the error message appears and is announced
    await expect(liveRegion).toHaveTextContent('Please enter a valid email address.');
    await expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
  },
};

/** Demonstrates toggling between polite and assertive politeness levels. */
export const PolitenessToggle: Story = {
  render: (args) => {
    const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');
    const [message, setMessage] = useState('Waiting…');
    return (
      <div>
        <button onClick={() => setPoliteness(politeness === 'polite' ? 'assertive' : 'polite')}>
          Toggle politeness (current: {politeness})
        </button>
        <button
          onClick={() => setMessage(`Announced at ${new Date().toLocaleTimeString()}`)}
          data-testid="announce-btn"
        >
          Announce
        </button>

        <LiveRegion {...args} politeness={politeness} visuallyHidden={false}>
          [{politeness}] {message}
        </LiveRegion>
      </div>
    );
  },
  args: {},
  play: async ({ canvas }) => {
    const liveRegion = canvas.getByRole('status');

    // Initially polite
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    await expect(liveRegion).toHaveTextContent('[polite] Waiting…');

    // Toggle to assertive
    const toggleBtn = canvas.getByRole('button', { name: /Toggle politeness/ });
    await userEvent.click(toggleBtn);

    await expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
    await expect(liveRegion).toHaveTextContent('[assertive] Waiting…');
  },
};
