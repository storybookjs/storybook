// @vitest-environment happy-dom

import type { Addon_StoryContext } from 'storybook/internal/types';
import { userEvent, within } from 'storybook/test';

import { vi, expect, describe, it } from 'vitest';
import { Component } from '@angular/core';
import { moduleMetadata, applicationConfig } from './decorators.ts';
import type { AngularRenderer } from './types.ts';

const canvasElement = document.createElement('div');

const defaultContext: Addon_StoryContext<AngularRenderer> = {
  componentId: 'unspecified',
  kind: 'unspecified',
  title: 'unspecified',
  id: 'unspecified',
  name: 'unspecified',
  story: 'unspecified',
  tags: [],
  parameters: {},
  initialArgs: {},
  args: {},
  argTypes: {},
  globals: {},
  globalTypes: {},
  storyGlobals: {},
  reporting: {
    reports: [],
    addReport: vi.fn(),
  },
  hooks: {},
  loaded: {},
  originalStoryFn: vi.fn(),
  viewMode: 'story',
  abortSignal: new AbortController().signal,
  canvasElement,
  step: vi.fn(),
  get context() {
    return defaultContext;
  },
  canvas: within(canvasElement),
  userEvent: userEvent.setup(),
  mount: vi.fn(),
};

class MockModule {}
class MockModuleTwo {}
class MockService {}
@Component({})
class MockComponent {}

describe('applicationConfig', () => {
  const provider1 = () => {};
  const provider2 = () => {};

  it('should apply global config', () => {
    expect(
      applicationConfig({
        providers: [provider1] as any,
      })(() => ({}), defaultContext)
    ).toEqual({
      applicationConfig: {
        providers: [provider1],
      },
    });
  });

  it('should apply story config', () => {
    expect(
      applicationConfig({
        providers: [],
      })(
        () => ({
          applicationConfig: {
            providers: [provider2] as any,
          },
        }),
        {
          ...defaultContext,
        }
      )
    ).toEqual({
      applicationConfig: {
        providers: [provider2],
      },
    });
  });

  it('should merge global and story config', () => {
    expect(
      applicationConfig({
        providers: [provider1] as any,
      })(
        () => ({
          applicationConfig: {
            providers: [provider2] as any,
          },
        }),
        {
          ...defaultContext,
        }
      )
    ).toEqual({
      applicationConfig: {
        providers: [provider1, provider2],
      },
    });
  });
});

describe('moduleMetadata', () => {
  it('should add metadata to a story without it', () => {
    const result = moduleMetadata({
      imports: [MockModule],
      providers: [MockService],
    })(
      () => ({}),
      // deepscan-disable-next-line
      defaultContext
    );

    expect(result).toEqual({
      moduleMetadata: {
        declarations: [],
        entryComponents: [],
        imports: [MockModule],
        schemas: [],
        providers: [MockService],
      },
    });
  });

  it('should combine with individual metadata on a story', () => {
    const result = moduleMetadata({
      imports: [MockModule],
    })(
      () => ({
        component: MockComponent,
        moduleMetadata: {
          imports: [MockModuleTwo],
          providers: [MockService],
        },
      }),
      // deepscan-disable-next-line
      defaultContext
    );

    expect(result).toEqual({
      component: MockComponent,
      moduleMetadata: {
        declarations: [],
        entryComponents: [],
        imports: [MockModule, MockModuleTwo],
        schemas: [],
        providers: [MockService],
      },
    });
  });

  it('should return the original metadata if passed null', () => {
    const result = moduleMetadata(null)(
      () => ({
        component: MockComponent,
        moduleMetadata: {
          providers: [MockService],
        },
      }),
      // deepscan-disable-next-line
      defaultContext
    );

    expect(result).toEqual({
      component: MockComponent,
      moduleMetadata: {
        declarations: [],
        entryComponents: [],
        imports: [],
        schemas: [],
        providers: [MockService],
      },
    });
  });
});
