import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, within } from 'storybook/test';

import type { ClassifiedError } from '../../../classified-error.ts';
import { Button } from '../Button/Button.tsx';
import { DependencyNotice } from './DependencyNotice.tsx';

// Classifier-shaped fixtures (the shape `classifyError` returns for the dependency kind), kept
// as literals so the rendered DOM — and the Chromatic baselines — stay stable.
const componentTestsFailed: ClassifiedError = {
  severity: 'negative',
  kind: 'dependency',
  title: "This story's component tests failed.",
  message: 'The component test run was skipped because the story failed to render.',
};

const causeOnly: ClassifiedError = {
  severity: 'negative',
  kind: 'dependency',
  title: 'The story failed to render, so this panel cannot run.',
  message: 'The component test run was skipped because the story failed to render.',
};

const dependencyError: ClassifiedError = {
  severity: 'negative',
  kind: 'dependency',
  title: 'This story failed to render.',
  cause: "The story's component failed to render, so the automated accessibility tests cannot run.",
  message: 'The component test run was skipped because the story failed to render.',
};

const meta = {
  component: DependencyNotice,
  parameters: { layout: 'padded' },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  tags: ['vitest'],
} satisfies Meta<typeof DependencyNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ComponentTestsFailed = {
  args: {
    error: componentTestsFailed,
    workaround:
      'Automated accessibility tests will not run until this is resolved. You can still test manually.',
    action: (
      <Button variant="solid" ariaLabel={false}>
        Run accessibility scan
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText("This story's component tests failed.")).toBeInTheDocument();
    expect(
      canvas.getByText(/Automated accessibility tests will not run until this is resolved/)
    ).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Run accessibility scan' })).toBeInTheDocument();

    await expect(document.body).toHaveLiveRegion({
      text: "This story's component tests failed.",
      level: 'polite',
    });
  },
} satisfies Story;

export const CauseOnly = {
  args: {
    error: causeOnly,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(
      canvas.getByText('The story failed to render, so this panel cannot run.')
    ).toBeInTheDocument();
    await expect(document.body).toHaveLiveRegion({
      text: 'The story failed to render, so this panel cannot run.',
      level: 'polite',
    });
  },
} satisfies Story;

// The dependency kind has one owner: this notice renders it, so the dependency story moved here
// from ErrorDetails when the kind gained its single owner.
export const Dependency = {
  args: {
    error: dependencyError,
    action: (
      <Button variant="solid" ariaLabel={false}>
        Run accessibility scan
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText('This story failed to render.')).toBeInTheDocument();
    expect(
      canvas.getByText(
        "The story's component failed to render, so the automated accessibility tests cannot run."
      )
    ).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Run accessibility scan' })).toBeInTheDocument();

    await expect(document.body).toHaveLiveRegion({
      text: 'This story failed to render.',
      level: 'polite',
    });
  },
} satisfies Story;

// Dark companions: story-level `globals: { sb_theme: 'dark' }` lets Chromatic capture the dark
// theme (play-function stories without an explicit theme are forced light by the UI decorator).
// Each spreads its base story so the interaction assertions stay identical by construction.
export const ComponentTestsFailedDark = {
  ...ComponentTestsFailed,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const CauseOnlyDark = {
  ...CauseOnly,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const DependencyDark = {
  ...Dependency,
  globals: { sb_theme: 'dark' },
} satisfies Story;
