import type { Canvas, WebRenderer } from 'storybook/internal/types';

import type { Component, ComponentProps } from 'svelte';

export interface SvelteRenderer<
  C extends Component<any, any, any> = Component<any, any, any>,
> extends WebRenderer {
  component: Component<this['T'] extends Record<string, any> ? this['T'] : any>;
  storyResult: this['T'] extends Record<string, any>
    ? SvelteStoryResult<this['T']>
    : SvelteStoryResult;

  mount: (
    Component?: C,
    // TODO add proper typesafety
    options?: Record<string, any> & { props: ComponentProps<C> }
  ) => Promise<Canvas>;
}

export interface SvelteStoryResult<
  Props extends Record<string, any> = any,
  Exports extends Record<string, any> = any,
  Bindings extends keyof Props | '' = string,
> {
  Component?: Component<Props, Exports, Bindings>;
  props?: Props;
  decorator?: Component<Props, Exports, Bindings>;
}
