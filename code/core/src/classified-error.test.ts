// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { logger } from 'storybook/internal/client-logger';
import { STORY_THREW_EXCEPTION } from 'storybook/internal/core-events';

import { classifyError, getErrorMetadata } from './classified-error.ts';
import type { ClassifiedError } from './classified-error.ts';
import { EmptyIndexError, MissingStoryAfterHmrError, NoStoryMatchError } from './preview-errors.ts';
import { PreviewWithSelection } from './preview-api/modules/preview-web/PreviewWithSelection.tsx';
import { StorybookError } from './storybook-error.ts';
import type { Renderer } from 'storybook/internal/types';

// Test-only consumer of the contract: renders the anatomy slots the way surfaces do, so fixtures
// can assert title, codeFrame, and errorCode land in the DOM. Ships nowhere.
function renderToDom(classified: ClassifiedError): HTMLElement {
  const root = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = classified.title;
  root.appendChild(title);
  if (classified.errorCode) {
    const code = document.createElement('span');
    code.setAttribute('data-testid', 'error-code');
    code.textContent = classified.errorCode;
    root.appendChild(code);
  }
  if (classified.codeFrame) {
    const frame = document.createElement('pre');
    frame.setAttribute('data-testid', 'code-frame');
    frame.textContent = classified.codeFrame.lines.join('\n');
    root.appendChild(frame);
    const caret = document.createElement('span');
    caret.setAttribute('data-testid', 'code-frame-caret');
    caret.textContent = [
      classified.codeFrame.file,
      classified.codeFrame.caret.line,
      classified.codeFrame.caret.column,
    ]
      .filter((part) => part !== undefined)
      .join(':');
    root.appendChild(caret);
  }
  if (classified.docsUrl) {
    const link = document.createElement('a');
    link.href = classified.docsUrl;
    link.textContent = 'View docs';
    root.appendChild(link);
  }
  return root;
}

class FixtureRenderError extends StorybookError {
  constructor() {
    super({
      name: 'FixtureRenderError',
      category: 'PREVIEW_API',
      code: 42,
      documentation: 'https://storybook.js.org/docs/fixture',
      message: 'The fixture exploded',
    });
  }
}

const browserStack = (origin: string) =>
  `TypeError: boom!\n    at render (${origin}/src/stories/Button.stories.tsx:57:16)\n    at next (${origin}/bundle.js:9:3)`;

// renderException only touches channel, view, and currentRender on `this`.
function fakeThis(emit: ReturnType<typeof vi.fn>, showErrorDisplay: ReturnType<typeof vi.fn>) {
  return {
    channel: { emit },
    view: { showErrorDisplay },
    currentRender: undefined,
  } as unknown as PreviewWithSelection<Renderer>;
}

describe('classifyError — one kind per audited throw site', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('render-exception: story render throw classified with title, codeFrame, severity', () => {
    const origin = globalThis.location?.origin ?? 'http://localhost:6006';
    const error = new TypeError('boom!');
    error.stack = browserStack(origin);

    const classified = classifyError(error, 'story-render', { storyName: 'Primary' });

    expect(classified.kind).toBe('render-exception');
    expect(classified.severity).toBe('negative');
    expect(classified.title).toBe('The Primary story failed to render.');
    expect(classified.message).toBe('boom!');
    expect(classified.codeFrame).toMatchObject({
      file: '/src/stories/Button.stories.tsx',
      line: 57,
      column: 16,
      caret: { line: 57, column: 16 },
    });

    const root = renderToDom(classified);
    expect(root.querySelector('h2')?.textContent).toBe('The Primary story failed to render.');
    expect(root.querySelector('[data-testid="code-frame"]')?.textContent).toContain('at render');
    expect(root.querySelector('[data-testid="code-frame-caret"]')?.textContent).toBe(
      '/src/stories/Button.stories.tsx:57:16'
    );
  });

  it('render-exception: falls back to storyId title when no story name is given', () => {
    const error = new Error('boom');
    error.stack = `Error: boom\n    at /repo/src/stories/Button.stories.tsx:57`;
    const classified = classifyError(error, 'story-render', { storyId: 'button--primary' });
    expect(classified.title).toBe('The button--primary story failed to render.');
    expect(classified.codeFrame).toMatchObject({
      file: '/repo/src/stories/Button.stories.tsx',
      line: 57,
    });
    expect(classified.codeFrame?.column).toBeUndefined();
    expect(classified.codeFrame?.caret).toEqual({ line: 57 });
  });

  it('render-exception: message-header lines ending in token:digits are not parsed as frames', () => {
    const error = new Error('failed to load @config:12:34');
    error.stack = `Error: failed to load @config:12:34\n    at /repo/src/stories/Button.stories.tsx:57:16`;
    const classified = classifyError(error, 'story-render', { storyName: 'Primary' });
    expect(classified.codeFrame?.file).toBe('/repo/src/stories/Button.stories.tsx');
  });

  it('story-not-found: all three audited not-found classes classify identically', () => {
    const fixtures = [
      new NoStoryMatchError({ storySpecifier: 'button--primary' }),
      new MissingStoryAfterHmrError({ storyId: 'button--primary' }),
      new EmptyIndexError(),
    ];
    const expectedCodes = ['SB_PREVIEW_API_0009', 'SB_PREVIEW_API_0001', 'SB_PREVIEW_API_0008'];

    fixtures.forEach((error, i) => {
      const classified = classifyError(error, 'story-missing');
      expect(classified.kind).toBe('story-not-found');
      expect(classified.severity).toBe('negative');
      expect(classified.title).toBe('The story could not be found.');
      expect(classified.errorCode).toBe(expectedCodes[i]);

      const root = renderToDom(classified);
      expect(root.querySelector('h2')?.textContent).toBe('The story could not be found.');
      expect(root.querySelector('[data-testid="error-code"]')?.textContent).toBe(expectedCodes[i]);
    });
  });

  it('app-config: app-layer title is trusted, description becomes the message', () => {
    const classified = classifyError(
      {
        title: 'No render function supplied',
        description: 'The story did not return a render function.',
      },
      'app-layer'
    );
    expect(classified.kind).toBe('app-config');
    expect(classified.severity).toBe('negative');
    expect(classified.title).toBe('No render function supplied');
    expect(classified.message).toBe('The story did not return a render function.');
    expect(classified.stack).toBeUndefined();
    expect(classified.codeFrame).toBeUndefined();
  });

  it('app-config: preview entry failure maps to the same kind with the generic title', () => {
    const classified = classifyError(new Error('preview entry failed'), 'config');
    expect(classified.kind).toBe('app-config');
    expect(classified.title).toBe('The story could not be displayed.');
    expect(classified.message).toBe('preview entry failed');
  });

  it('dependency: an upstream failure blocking a dependent panel', () => {
    const classified = classifyError(new TypeError('boom!'), 'dependency');
    expect(classified.kind).toBe('dependency');
    expect(classified.severity).toBe('negative');
    expect(classified.title).toBe('This story failed to render.');
    expect(classified.message).toBe('boom!');
  });

  it('manager-crash: the only critical tier, with component stack and vitest context', () => {
    const error = new Error('Test run died');
    error.stack =
      'Error: Test run died\n    at /home/dev/repo/src/stories/Button.stories.tsx:57:16';
    const classified = classifyError(error, 'manager', {
      componentStack: '    in App\n    in Manager',
      testPath: 'src/stories/Button.stories.tsx',
      testLocation: {
        file: 'src/stories/Button.stories.tsx',
        line: 57,
        column: 16,
        method: 'Primary',
      },
    });

    expect(classified.kind).toBe('manager-crash');
    expect(classified.severity).toBe('critical');
    expect(classified.title).toBe('Something went wrong.');
    expect(classified.componentStack).toBe('    in App\n    in Manager');
    expect(classified.testPath).toBe('src/stories/Button.stories.tsx');
    expect(classified.testLocation).toMatchObject({ line: 57, method: 'Primary' });
    expect(classified.codeFrame).toMatchObject({
      file: '/home/dev/repo/src/stories/Button.stories.tsx',
      line: 57,
    });

    const root = renderToDom(classified);
    expect(root.querySelector('[data-testid="code-frame-caret"]')?.textContent).toBe(
      '/home/dev/repo/src/stories/Button.stories.tsx:57:16'
    );
  });

  it('is total: null, undefined, and string inputs produce a renderable contract', () => {
    for (const input of [null, undefined, 'weird string', 42]) {
      const classified = classifyError(input, 'dependency');
      expect(classified.kind).toBe('dependency');
      expect(typeof classified.message).toBe('string');
      expect(renderToDom(classified).querySelector('h2')?.textContent).toBe(
        'This story failed to render.'
      );
    }
    expect(classifyError(null, 'dependency').message).toBe('Unknown error');
    expect(classifyError('weird string', 'dependency').message).toBe('weird string');
  });
});

describe('getErrorMetadata — structured fields for event forwarding', () => {
  it('extracts category, errorCode, and docsUrl from a StorybookError', () => {
    expect(getErrorMetadata(new FixtureRenderError())).toEqual({
      category: 'PREVIEW_API',
      errorCode: 'SB_PREVIEW_API_0042',
      docsUrl: 'https://storybook.js.org/docs/fixture?ref=error',
    });
  });

  it('derives the error-page URL for documentation: true, and nothing for arrays', () => {
    class DocumentedError extends StorybookError {
      constructor(documentation: boolean | string | string[]) {
        super({
          name: 'DocumentedError',
          category: 'PREVIEW_API',
          code: 9,
          documentation,
          message: 'msg',
        });
      }
    }
    expect(getErrorMetadata(new DocumentedError(true)).docsUrl).toBe(
      'https://storybook.js.org/error/SB_PREVIEW_API_0009?ref=error'
    );
    expect(
      getErrorMetadata(new DocumentedError(['https://a.example', 'https://b.example'])).docsUrl
    ).toBeUndefined();
    expect(getErrorMetadata(new DocumentedError(true)).errorCode).toBe('SB_PREVIEW_API_0009');
  });

  it('returns an empty payload for plain errors', () => {
    expect(getErrorMetadata(new TypeError('boom'))).toEqual({});
    expect(getErrorMetadata('not an error')).toEqual({});
  });
});

describe('PreviewWithSelection.renderException — event payload forwarding', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards StorybookError metadata through STORY_THREW_EXCEPTION', () => {
    const emit = vi.fn();
    const showErrorDisplay = vi.fn();

    const error = new FixtureRenderError();
    PreviewWithSelection.prototype.renderException.call(
      fakeThis(emit, showErrorDisplay),
      'button--primary',
      error
    );

    expect(emit).toHaveBeenCalledWith(
      STORY_THREW_EXCEPTION,
      expect.objectContaining({
        name: 'SB_PREVIEW_API_0042 (FixtureRenderError)',
        message: expect.stringContaining('The fixture exploded'),
        stack: expect.any(String),
        category: 'PREVIEW_API',
        errorCode: 'SB_PREVIEW_API_0042',
        docsUrl: 'https://storybook.js.org/docs/fixture?ref=error',
      })
    );
    expect(showErrorDisplay).toHaveBeenCalledWith(error);
  });

  it('adds no metadata keys for non-StorybookError render exceptions', () => {
    const emit = vi.fn();
    const showErrorDisplay = vi.fn();

    const error = new TypeError('boom!');
    PreviewWithSelection.prototype.renderException.call(
      fakeThis(emit, showErrorDisplay),
      'button--primary',
      error
    );

    expect(emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, {
      name: 'TypeError',
      message: 'boom!',
      stack: error.stack,
    });
  });
});
