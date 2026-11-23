// @vitest-environment happy-dom
import type { ArgTypes, Args } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { renderToCanvas } from './render.ts';
import type { FetchStoryHtmlType } from './types.ts';

const paramsSentToServer = async (args: Args, argTypes: ArgTypes = {}) => {
  const fetchStoryHtml = vi.fn<FetchStoryHtmlType>(async () => '<div></div>');
  const storyContext = {
    args,
    argTypes,
    globals: {},
    parameters: { server: { url: 'http://localhost', fetchStoryHtml } },
  };

  await renderToCanvas(
    {
      id: 'story--id',
      title: 'Story',
      name: 'Default',
      showMain: vi.fn(),
      showError: vi.fn(),
      forceRemount: true,
      storyFn: vi.fn(),
      storyContext,
    } as any,
    document.createElement('div')
  );

  return fetchStoryHtml.mock.calls[0][2];
};

describe('renderToCanvas', () => {
  it('sends a Date arg as an ISO string when the preview holds no argTypes', async () => {
    const date = new Date('2024-05-06T07:08:09.000Z');

    expect(await paramsSentToServer({ date })).toEqual({ date: '2024-05-06T07:08:09.000Z' });
  });

  it('sends object and array args as JSON when the preview holds no argTypes', async () => {
    expect(await paramsSentToServer({ object: { a: 1 }, array: [1, 2] })).toEqual({
      object: '{"a":1}',
      array: '[1,2]',
    });
  });

  it('sends a null arg as the JSON string null, the value the URL query receives either way', async () => {
    expect(await paramsSentToServer({ empty: null })).toEqual({ empty: 'null' });
  });

  it('sends the timestamp a date control holds as an ISO string', async () => {
    const timestamp = Date.parse('2024-05-06T07:08:09.000Z');

    expect(
      await paramsSentToServer(
        { date: timestamp },
        { date: { name: 'date', control: { type: 'date' } } }
      )
    ).toEqual({ date: '2024-05-06T07:08:09.000Z' });
  });

  it('sends a primitive arg unchanged', async () => {
    expect(await paramsSentToServer({ label: 'Button', count: 3, primary: true })).toEqual({
      label: 'Button',
      count: 3,
      primary: true,
    });
  });
});
