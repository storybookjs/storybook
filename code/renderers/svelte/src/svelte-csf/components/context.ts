import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';
import type { StoryName } from '@storybook/types';
import {
  type ComponentProps,
  type SvelteComponent,
  getContext,
  hasContext,
  setContext,
} from 'svelte';
import { type Writable, writable } from 'svelte/store';
import type { SetOptional, SetRequired } from 'type-fest';

const CONTEXT_KEY = 'storybook-registration-context';
const CONTEXT_KEY_COMPONENT = 'storybook-registration-context-component';

export type AddonTemplateObj<Component extends SvelteComponent> = Omit<
  StoryObj<Component>,
  'render'
> & {
  id: string;
};

export type AddonStoryObj<Component extends SvelteComponent> = Omit<
  SetRequired<StoryObj<Component>, 'name'>,
  'render'
> & {
  templateId?: AddonTemplateObj<Component>['id'];
};

export type Repositories<Component extends SvelteComponent> = {
  meta: Meta<Component>;
  templates: Map<string, AddonTemplateObj<Component>>;
  stories: Map<StoryName, AddonStoryObj<Component>>;
};

export interface Context<Component extends SvelteComponent = SvelteComponent> {
  render: boolean;
  registerTemplate: (template: AddonTemplateObj<Component>) => void;
  registerStory: (story: AddonStoryObj<Component>) => void;
}

export interface RegistrationContext<Component extends SvelteComponent = SvelteComponent> {
  argsStore: Writable<ComponentProps<Component>>;
  storyContextStore: Writable<StoryContext<ComponentProps<Component>>>;
  currentTemplateId: Writable<AddonTemplateObj<Component>['id'] | undefined>;
  currentStoryName: Writable<StoryName | undefined>;
}

export function createRenderContext<Component extends SvelteComponent>(
  props: SetOptional<Context<Component>, 'registerStory' | 'registerTemplate'>
) {
  setContext<Context<Component>>(CONTEXT_KEY, {
    ...props,
    registerStory: props.registerStory ?? (() => {}),
    registerTemplate: props.registerTemplate ?? (() => {}),
  });

  resetRenderContext();
}

export function createRegistrationContext<Component extends SvelteComponent>(
  repositories: Repositories<Component>
) {
  const { templates, stories } = repositories;

  createRenderContext<Component>({
    render: false,
    registerTemplate: (template) => {
      templates.set(template.id, template);
    },
    registerStory: (story) => {
      stories.set(story.name, story);
    },
  });
}

export function useContext<Component extends SvelteComponent>() {
  if (!hasContext(CONTEXT_KEY)) {
    createRenderContext<Component>({ render: true });
  }

  return getContext<Context<Component>>(CONTEXT_KEY);
}

function resetRenderContext<Component extends SvelteComponent>() {
  setContext<RegistrationContext<Component>>(CONTEXT_KEY_COMPONENT, {
    argsStore: writable(),
    storyContextStore: writable(),
    currentTemplateId: writable(),
    currentStoryName: writable(),
  });
}

export function getRenderContext<
  Component extends SvelteComponent,
>(): RegistrationContext<Component> {
  if (!hasContext(CONTEXT_KEY_COMPONENT)) {
    resetRenderContext();
  }

  return getContext<RegistrationContext<Component>>(CONTEXT_KEY_COMPONENT);
}

export function setRenderContext<Component extends SvelteComponent>({
  args,
  storyContext,
  currentTemplateId,
  currentStoryName,
}: {
  args: ComponentProps<Component>;
  storyContext: StoryContext<ComponentProps<Component>>;
  currentTemplateId: AddonTemplateObj<Component>['id'] | undefined;
  currentStoryName: StoryName | undefined;
}) {
  const ctx = getRenderContext<Component>();

  ctx.argsStore.set(args);
  ctx.storyContextStore.set(storyContext);
  ctx.currentStoryName.set(currentStoryName);
  ctx.currentTemplateId.set(currentTemplateId);
}
