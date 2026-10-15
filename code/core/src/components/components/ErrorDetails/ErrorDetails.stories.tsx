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
        canvas.getByRole('heading', {
          name: 'The Primary story failed to render.',
        })
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
      // Collapsible keeps the content mounted (aria-hidden, collapsed to zero size), so the
      // collapsed state asserts visibility and the expanded/aria state, not absence from the DOM.
      const detail = canvasElement.querySelector('[data-testid="raw-detail"]');
      if (!detail) {
        throw new Error('raw-detail collapsible not found');
      }
      const toggle = canvas.getByRole('button', { name: 'Expand error' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(detail).not.toBeVisible();
      await userEvent.click(toggle);
      const expandedToggle = canvas.getByRole('button', { name: 'Collapse error' });
      expect(expandedToggle).toHaveAttribute('aria-expanded', 'true');
      expect(detail).toBeVisible();
      await userEvent.click(expandedToggle);
      expect(canvas.getByRole('button', { name: 'Expand error' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      expect(detail).not.toBeVisible();
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

    await step('Carries the neutral tone, not the error border', async () => {
      const container = canvasElement.querySelector('[data-kind="story-not-found"]');
      if (!container) {
        throw new Error('story-not-found container not found');
      }
      // The tone attribute is the presentation decision itself — asserting on it survives any
      // token or theme change that would silently hollow out a computed-colour assertion.
      expect(container.getAttribute('data-tone')).toBe('neutral');
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
      expect(canvas.getByText(/Component Stack:/)).toBeVisible();
      expect(canvas.getByText(/at AddonPanel/)).toBeInTheDocument();
    });
  },
} satisfies Story;

// Dark companions: story-level `globals: { sb_theme: 'dark' }` lets Chromatic capture the dark
// theme (play-function stories without an explicit theme are forced light by the UI decorator).
// Each spreads its base story so the interaction assertions stay identical by construction.
export const RenderExceptionDark = {
  ...RenderException,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const StoryNotFoundDark = {
  ...StoryNotFound,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const AppConfigErrorDark = {
  ...AppConfigError,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const VitestFailureDark = {
  ...VitestFailure,
  globals: { sb_theme: 'dark' },
} satisfies Story;

export const ManagerCrashDark = {
  ...ManagerCrash,
  globals: { sb_theme: 'dark' },
} satisfies Story;
