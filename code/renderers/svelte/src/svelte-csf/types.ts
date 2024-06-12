import type { Meta, StoryObj as BaseStoryObj } from '@storybook/svelte';
import type { ComponentProps, ComponentType, Snippet } from 'svelte';

type SnippetsToPrimitives<Args> = {
  [ArgKey in keyof Args]?: Args[ArgKey] extends Snippet
    ? Snippet | string | number | boolean | undefined
    : Args[ArgKey];
};

export type StoryObj<TMeta extends Meta> = Omit<BaseStoryObj<TMeta>, 'args'> & {
  args?: TMeta['component'] extends ComponentType<infer Component>
    ? Partial<SnippetsToPrimitives<ComponentProps<Component>>>
    : unknown;
};
