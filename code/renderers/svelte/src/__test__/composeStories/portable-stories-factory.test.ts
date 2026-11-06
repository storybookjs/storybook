// @vitest-environment happy-dom
import { cleanup, screen } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';

import * as stories from './Button.csf4.stories.ts';

afterEach(() => {
  cleanup();
});

it('runs the play function', async () => {
  await stories.CSF3InputFieldFilled.run();
  expect((screen.getByTestId('input') as HTMLInputElement).value).toEqual('Hello world!');
});

it('merges the args of an extended story', () => {
  expect(stories.Extended.composed.args).toEqual({
    label: 'extended',
    size: 'large',
    primary: true,
  });
});

const testCases = Object.entries(stories).map(
  ([name, Story]) => [name, Story] as [string, typeof Story]
);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  await Story.run();
  expect(document.body).toMatchSnapshot();
});
