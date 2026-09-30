/** @vitest-environment happy-dom */
import type { ArgsStoryFn } from 'storybook/internal/types';
import type { StoryContext, WebComponentsRenderer } from './types.ts';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../../core/src/shared/open-service/service-registry.ts';
import { registerDocgenPayload } from './docgen-render/docgen-test-utils.ts';
import { beforeEach as previewBeforeEach } from './entry-preview.ts';
import { render } from './render.ts';

describe('entry preview beforeEach', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('loads docgen only for the default render', async () => {
    const customRender: ArgsStoryFn<WebComponentsRenderer> = () => document.createElement('x-card');

    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    const handler = registerDocgenPayload({
      id: 'x-card',
      name: 'x-card',
      path: './x-card.ts',
      jsDocTags: {},
      argTypes: {},
    });
    const runBeforeEach = previewBeforeEach[0]!;

    await runBeforeEach({
      id: 'x-card--custom',
      componentId: 'x-card',
      component: 'x-card',
      parameters: {},
      originalStoryFn: customRender,
    } as StoryContext);
    expect(handler).not.toHaveBeenCalled();

    await runBeforeEach({
      id: 'x-card--default',
      componentId: 'x-card',
      component: 'x-card',
      parameters: {},
      originalStoryFn: render,
    } as StoryContext);
    expect(handler).toHaveBeenCalledOnce();
  });
});
