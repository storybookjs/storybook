import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import type { ClassifiedError } from '../../../classified-error.ts';
import { Button } from '../Button/Button.tsx';
import { ErrorDetails } from './ErrorDetails.tsx';

// Classifier-shaped fixtures (the shape `classifyError` returns), kept as literals so the
// rendered DOM — and the Chromatic baselines — stay stable across environments.
const renderException: ClassifiedError = {
  severity: 'negative',
  kind: 'render-exception',
  title: 'The Primary story failed to render.',
  message: 'Error is not a constructor',
  codeFrame: {
    file: 'src/stories/Button.stories.tsx',
    line: 57,
    column: 16,
    lines: ['at Primary (src/stories/Button.stories.tsx:57:16)'],
    caret: { line: 57, column: 16 },
  },
  stack: [
    'Error: Error is not a constructor',
    '    at Primary (src/stories/Button.stories.tsx:57:16)',
    '    at renderStory (http://localhost:6006/sb-preview/story.js:1:234567)',
    '    at StoryStore.renderStoryFn (http://localhost:6006/node_modules/.vite/deps/storybook_preview.js:5:12345)',
    '    at doRender (http://localhost:6006/sb-preview/runtime.js:1:9876)',
  ].join('\n'),
};

const storyNotFound: ClassifiedError = {
  severity: 'negative',
  kind: 'story-not-found',
  title: 'The story could not be found.',
  message: "Couldn't find story matching 'primary'",
  errorCode: 'SB_PREVIEW_API_0009',
  docsUrl: 'https://storybook.js.org/error/SB_PREVIEW_API_0009?ref=error',
};

const appConfigError: ClassifiedError = {
  severity: 'negative',
  kind: 'app-config',
  title: 'No suitable renderer found.',
  cause:
    'The story requested framework "unknown-framework", which this Storybook does not have installed.',
  message: 'No renderer found for framework "unknown-framework"',
  stack:
    'Error: No renderer found for framework "unknown-framework"\n    at renderPreviewEntry (src/preview.ts:12:3)',
};

const dependencyError: ClassifiedError = {
  severity: 'negative',
  kind: 'dependency',
  title: 'This story failed to render.',
  cause: "The story's component failed to render, so the automated accessibility tests cannot run.",
  message: 'The component test run was skipped because the story failed to render.',
};

const vitestFailure: ClassifiedError = {
  severity: 'negative',
  kind: 'app-config',
  title: 'The component tests failed.',
  message: 'AssertionError: expected 2 to be 3',
  testPath: 'src/stories/Button.stories.tsx > Primary',
  codeFrame: {
    file: 'src/stories/Button.stories.tsx',
    line: 57,
    column: 16,
    lines: ['at /repo/src/stories/Button.stories.tsx:57:16'],
    caret: { line: 57, column: 16 },
  },
  stack: 'AssertionError: expected 2 to be 3\n    at /repo/src/stories/Button.stories.tsx:57:16',
};

const managerCrash: ClassifiedError = {
  severity: 'critical',
  kind: 'manager-crash',
  title: 'Something went wrong.',
  message: 'Cannot read properties of undefined (reading "addons")',
  stack:
    'TypeError: Cannot read properties of undefined (reading "addons")\n    at getPanels (http://localhost:6006/manager.js:1:234567)\n    at Layout (http://localhost:6006/manager.js:1:234000)',
  componentStack: '    at AddonPanel\n    at Sidebar\n    at App',
};

const meta = {
  component: ErrorDetails,
  parameters: { layout: 'padded' },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  tags: ['vitest'],
} satisfies Meta<typeof ErrorDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RenderException = {
  args: {
    error: renderException,
    action: (
      <Button variant="solid" ariaLabel={false}>
        Rerun story
      </Button>
    ),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Human title leads, raw message stays in diagnostics', async () => {
      expect(
        canvas.getByRole('heading', { name: 'The Primary story failed to render.' })
      ).toBeInTheDocument();
      expect(canvas.getByText('Error is not a constructor')).toBeInTheDocument();
      expect(
        canvas.getByText('at Primary (src/stories/Button.stories.tsx:57:16)')
      ).toBeInTheDocument();
    });

    await step('Failure transition is announced politely', async () => {
      await expect(document.body).toHaveLiveRegion({
        text: 'The Primary story failed to render.',
        level: 'polite',
      });
    });

    await step('Raw stack stays collapsed until expanded', async () => {
      expect(canvas.queryByText(/at renderStory/)).toBeNull();
      await userEvent.click(canvas.getByRole('button', { name: 'Expand error' }));
      expect(canvas.getByText(/at renderStory/)).toBeInTheDocument();
      await userEvent.click(canvas.getByRole('button', { name: 'Collapse error' }));
      expect(canvas.queryByText(/at renderStory/)).toBeNull();
    });

    await step('Copy error is offered wherever a stack exists', async () => {
      expect(canvas.getByRole('button', { name: 'Copy error' })).toBeInTheDocument();
    });
  },
} satisfies Story;

export const StoryNotFound = {
  args: {
    error: storyNotFound,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Renders neutral: no error pill', async () => {
      expect(canvas.queryByText('Error')).toBeNull();
    });

    await step('No negative border token applies', async () => {
      const container = canvasElement.querySelector('[data-kind="story-not-found"]');
      if (!container) {
        throw new Error('story-not-found container not found');
      }
      // themes.light.borderColor.negative is #FFC3AD, which computed style normalizes to rgb().
      expect(getComputedStyle(container).borderColor).not.toBe('rgb(255, 195, 173)');
    });

    await step('Structured id renders as small print with a Troubleshoot link', async () => {
      expect(canvas.getByText('SB_PREVIEW_API_0009')).toBeInTheDocument();
      expect(canvas.getByRole('link', { name: 'Troubleshoot' })).toHaveAttribute(
        'href',
        storyNotFound.docsUrl
      );
    });
  },
} satisfies Story;

export const AppConfigError = {
  args: {
    error: appConfigError,
    action: (
      <Button variant="solid" ariaLabel={false}>
        Reload
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(
      canvas.getByRole('heading', { name: 'No suitable renderer found.' })
    ).toBeInTheDocument();
    expect(canvas.getByText(/The story requested framework/)).toBeInTheDocument();
    await expect(document.body).toHaveLiveRegion({
      text: 'No suitable renderer found.',
      level: 'polite',
    });
  },
} satisfies Story;

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

    expect(
      canvas.getByRole('heading', { name: 'This story failed to render.' })
    ).toBeInTheDocument();
    await expect(document.body).toHaveLiveRegion({
      text: 'This story failed to render.',
      level: 'polite',
    });
  },
} satisfies Story;

export const VitestFailure = {
  args: {
    error: vitestFailure,
    action: (
      <Button variant="solid" ariaLabel={false}>
        Rerun
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText('FAIL src/stories/Button.stories.tsx > Primary')).toBeInTheDocument();
    expect(canvas.getByText('src/stories/Button.stories.tsx:57:16')).toBeInTheDocument();
  },
} satisfies Story;

export const ManagerCrash = {
  args: {
    error: managerCrash,
    action: (
      <Button variant="solid" ariaLabel={false}>
        Reload Storybook
      </Button>
    ),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Critical failures announce assertively', async () => {
      await expect(document.body).toHaveLiveRegion({
        text: 'Something went wrong.',
        level: 'assertive',
      });
    });

    await step('Component stack renders with the raw stack in the expanded block', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Expand error' }));
      expect(canvas.getByText(/Component Stack:/)).toBeInTheDocument();
      expect(canvas.getByText(/at AddonPanel/)).toBeInTheDocument();
    });
  },
} satisfies Story;
