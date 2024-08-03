import type {
  Canvas,
  StoryContext as StoryContextBase,
  WebRenderer,
} from 'storybook/internal/types';
import type { ComponentConstructorOptions, ComponentEvents, SvelteComponent } from 'svelte';

export type StoryContext = StoryContextBase<SvelteRenderer>;

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export interface MountViewArgs {
  Component: any;
  target: any;
  props: MountProps;
  on: any;
  Wrapper: any;
  WrapperData: any;
}

interface MountProps {
  rounded: boolean;
  text: string;
}

type ComponentType<
  Props extends Record<string, any> = any,
  Events extends Record<string, any> = any,
> = new (options: ComponentConstructorOptions<Props>) => {
  [P in keyof SvelteComponent<Props> as P extends `$$${string}` ? never : P]: SvelteComponent<
    Props,
    Events
  >[P];
};

export interface SvelteRenderer<C extends SvelteComponent = SvelteComponent> extends WebRenderer {
  component: ComponentType<this['T'] extends Record<string, any> ? this['T'] : any>;
  storyResult: this['T'] extends Record<string, any>
    ? SvelteStoryResult<this['T'], ComponentEvents<C>>
    : SvelteStoryResult;

  mount: (
    Component?: ComponentType,
    // TODO add proper typesafety
    options?: Record<string, any> & { props: Record<string, any> }
  ) => Promise<Canvas>;
}

export interface SvelteStoryResult<
  Props extends Record<string, any> = any,
  Events extends Record<string, any> = any,
> {
  Component?: ComponentType<Props>;
  on?: Record<string, any> extends Events
    ? Record<string, (event: CustomEvent) => void>
    : { [K in keyof Events as string extends K ? never : K]?: (event: Events[K]) => void };
  props?: Props;
  decorator?: ComponentType<Props>;
}
