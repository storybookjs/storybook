import { RESET_STORY_ARGS } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/preview-api';
import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

/*
! DO NOT change these PreviewRender and createSvelte5Props imports to relative paths, it will break them.
! Relative imports will be compiled at build time by tsup, but we need Svelte to compile them
! when compiling the rest of the Svelte files.
*/
import PreviewRender from '@storybook/svelte/internal/PreviewRender.svelte';
// @ts-expect-error Don't know why TS doesn't pick up the types export here
import { createSvelte5Props } from '@storybook/svelte/internal/createSvelte5Props';

import * as svelte from 'svelte';

import type { SvelteRenderer } from './types';
import { IS_SVELTE_V4 } from './utils';

export function renderToCanvas(
  renderContext: RenderContext<SvelteRenderer>,
  canvasElement: SvelteRenderer['canvasElement']
) {
  if (IS_SVELTE_V4) {
    return renderToCanvasV4(renderContext, canvasElement);
  } else {
    return renderToCanvasV5(renderContext, canvasElement);
  }
}

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

const componentsByDomElementV4 = new Map<SvelteRenderer['canvasElement'], svelte.SvelteComponent>();

function renderToCanvasV4(
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
    if (!componentsByDomElementV4.has(canvasElementToUnmount)) {
      return;
    }
    componentsByDomElementV4.get(canvasElementToUnmount)!.$destroy();
    componentsByDomElementV4.delete(canvasElementToUnmount);
    canvasElementToUnmount.innerHTML = '';
  }
  const existingComponent = componentsByDomElementV4.get(canvasElement);

  let remount = forceRemount;
  if (storyIdsToRemountFromResetArgsEvent.has(storyContext.id)) {
    remount = true;
    storyIdsToRemountFromResetArgsEvent.delete(storyContext.id);
  }

  if (remount) {
    unmount(canvasElement);
  }

  if (!existingComponent || remount) {
    const mountedComponent = new PreviewRender({
      target: canvasElement,
      props: {
        storyFn,
        storyContext,
        name,
        title,
        showError,
      },
    });
    componentsByDomElementV4.set(canvasElement, mountedComponent);
  } else {
    existingComponent.$set({
      storyFn,
      storyContext,
      name,
      title,
      showError,
    });
  }

  showMain();

  // unmount the component when the story changes
  return () => {
    unmount(canvasElement);
  };
}

const componentsByDomElementV5 = new Map<
  SvelteRenderer['canvasElement'],
  { mountedComponent: ReturnType<(typeof svelte)['mount']>; props: RenderContext }
>();

function renderToCanvasV5(
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
    const { mountedComponent } = componentsByDomElementV5.get(canvasElementToUnmount) ?? {};
    if (!mountedComponent) {
      return;
    }
    svelte.unmount(mountedComponent);
    componentsByDomElementV5.delete(canvasElementToUnmount);
  }

  const existingComponent = componentsByDomElementV5.get(canvasElement);

  let remount = forceRemount;
  if (storyIdsToRemountFromResetArgsEvent.has(storyContext.id)) {
    remount = true;
    storyIdsToRemountFromResetArgsEvent.delete(storyContext.id);
  }

  if (remount) {
    unmount(canvasElement);
  }

  if (!existingComponent || remount) {
    const props = createSvelte5Props({
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
    componentsByDomElementV5.set(canvasElement, { mountedComponent, props });
  } else {
    // We need to mutate the existing props for Svelte reactivity to work, we can't just re-assign them
    Object.assign(existingComponent.props, {
      storyFn,
      storyContext,
      name,
      title,
      showError,
    });
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
