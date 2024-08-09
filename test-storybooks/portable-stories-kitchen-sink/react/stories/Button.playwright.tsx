/* eslint-disable @typescript-eslint/no-explicit-any */
import { createTest } from '@storybook/react/experimental-playwright';
import { test as base, expect } from '@playwright/experimental-ct-react';
import stories, { SingleComposedStory, WithSpanishGlobal } from './Button.stories.playwright';

const test = createTest(base);

test('renders with composeStories (plural)', async ({ mount }) => {
  const component = await mount(<stories.CSF3Primary />);
  await expect(component).toContainText('Global Decorator');
  await expect(component).toContainText('foo'); // default arg for the story
});

test('renders with composeStory (singular)', async ({ mount }) => {
  const component = await mount(<SingleComposedStory />);
  await expect(component).toContainText('Global Decorator');
  await expect(component).toContainText('foo'); // default arg for the story
});

test('renders story with props', async ({ mount }) => {
  const component = await mount(
    <stories.CSF3Button primary={true}>child from test</stories.CSF3Button>
  );
  await expect(component).toContainText('child from test');
  await expect(component.getByRole('button')).toHaveClass(/storybook-button--primary/);
});

test('renders story with custom render', async ({ mount }) => {
  const component = await mount(<stories.CSF3ButtonWithRender />);
  await expect(component.getByTestId('custom-render')).toContainText(
    'I am a custom render function'
  );
  await expect(component.getByRole('button')).toHaveText('foo');
});

test('renders story with global annotations', async ({ mount }) => {
  const component = await mount(<WithSpanishGlobal />);
  await expect(component).toContainText('Hola!');
});

test('calls loaders', async ({ mount }) => {
  const component = await mount(<stories.WithLoader />);
  await expect(component.getByTestId('loaded-data')).toContainText('loaded data');
  await expect(component.getByTestId('mock-data')).toContainText('mockFn return value');
});
