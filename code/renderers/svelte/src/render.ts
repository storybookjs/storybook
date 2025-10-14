import { RESET_STORY_ARGS } from 'storybook/internal/core-events';
import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

/*
! DO NOT change these PreviewRender and createSvelte5Props imports to relative paths, it will break them.
! Relative imports will be compiled at build time by the bundler, but we need Svelte to compile them
! when compiling the rest of the Svelte files.
*/
import PreviewRender from '@storybook/svelte/internal/PreviewRender.svelte';
// @ts-expect-error Don't know why TS doesn't pick up the types export here
import { createReactiveProps } from '@storybook/svelte/internal/createReactiveProps';

import { addons } from 'storybook/preview-api';
import * as svelte from 'svelte';

import type { SvelteRenderer } from './types';

/**
 * This is a workaround for the issue that when resetting args, the story needs to be remounted
 * completely to revert to the component's default props. This is because Svelte does not itself
 * revert to defaults when a prop is undefined. See
 * https://github.com/storybookjs/storybook/issues/21470#issuecomment-1467056479
 *
 * We listen for the `RESET_STORY_ARGS` event and store the storyId to be reset We then use this in
 * the renderToCanvas function to force remount the story
 */
const storyIdsToRemountFromResetArgsEvent = new Set<string>();

addons.getChannel().on(RESET_STORY_ARGS, ({ storyId }) => {
  storyIdsToRemountFromResetArgsEvent.add(storyId);
});

const componentsByDomElement = new Map<
  SvelteRenderer['canvasElement'],
  { mountedComponent: ReturnType<(typeof svelte)['mount']>; props: RenderContext }
>();

export async function renderToCanvas(
  {
    storyFn,
    title,
    name,
    showMain,
    showError,
    storyContext,
    forceRemount,
  }: RenderContext<SvelteRenderer>,
  canvasElement: SvelteRenderer['canvasElement']
) {
  function unmount(canvasElementToUnmount: SvelteRenderer['canvasElement']) {
    const { mountedComponent } = componentsByDomElement.get(canvasElementToUnmount) ?? {};
    if (!mountedComponent) {
      return;
    }
    svelte.unmount(mountedComponent);
    componentsByDomElement.delete(canvasElementToUnmount);
  }

  const existingComponent = componentsByDomElement.get(canvasElement);

  let remount = forceRemount;
  if (storyIdsToRemountFromResetArgsEvent.has(storyContext.id)) {
    remount = true;
    storyIdsToRemountFromResetArgsEvent.delete(storyContext.id);
  }

  if (remount) {
    unmount(canvasElement);
  }

  if (!existingComponent || remount) {
    const props = createReactiveProps({
      storyFn,
      storyContext,
      name,
      title,
      showError,
    });
    const mountedComponent = svelte.mount(PreviewRender, {
      target: canvasElement,
      props,
    });
    componentsByDomElement.set(canvasElement, { mountedComponent, props });
    await svelte.tick();
  } else {
    // We need to mutate the existing props for Svelte reactivity to work, we can't just re-assign them
    Object.assign(existingComponent.props, {
      storyFn,
      storyContext,
      name,
      title,
      showError,
    });
    await svelte.tick();
  }

  showMain();

  // unmount the component when the story changes
  return () => {
    unmount(canvasElement);
  };
}

export const render: ArgsStoryFn<SvelteRenderer> = (args, context) => {
  const { id, component: Component } = context;
  if (!Component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  return { Component, props: args };
};
