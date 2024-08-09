/* eslint-disable no-underscore-dangle */
import { deprecate } from 'storybook/internal/client-logger';
import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import { addons, useEffect } from 'storybook/internal/preview-api';
import type {
  ArgTypes,
  Args,
  ArgsStoryFn,
  DecoratorFunction,
  StoryContext,
} from 'storybook/internal/types';

import type { SvelteComponentDoc } from 'sveltedoc-parser';

import type { SvelteRenderer, SvelteStoryResult } from '../types';

/**
 * Check if the source-code should be generated.
 *
 * @param context StoryContext
 */
const skipSourceRender = (context: StoryContext<SvelteRenderer>) => {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
};

/**
 * Transform a key/value to a svelte declaration as string.
 *
 * Default values are ommited
 *
 * @param key Key
 * @param value Value
 * @param argTypes Component ArgTypes
 */
function toSvelteProperty(key: string, value: any, argTypes: ArgTypes): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const argType = argTypes[key];

  // default value ?
  if (argType && argType.defaultValue === value) {
    return null;
  }

  // event should be skipped
  if (argType && argType.action) {
    return null;
  }

  if (value === true) {
    return key;
  }

  if (typeof value === 'string') {
    return `${key}=${JSON.stringify(value)}`;
  }

  // handle function
  if (typeof value === 'function') {
    return `${key}={<handler>}`;
  }

  return `${key}={${JSON.stringify(value)}}`;
}

/**
 * Extract a component name.
 *
 * @param component Component
 */
function getComponentName(component: any): string | null {
  if (component == null) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { __docgen = {} } = component;
  let { name } = __docgen;

  if (!name) {
    return component.name;
  }

  if (name.endsWith('.svelte')) {
    name = name.substring(0, name.length - 7);
  }
  return name;
}

/**
 * Generate a svelte template.
 *
 * @param component Component
 * @param args Args
 * @param argTypes ArgTypes
 * @param slotProperty Property used to simulate a slot
 */
export function generateSvelteSource(
  component: any,
  args: Args,
  argTypes: ArgTypes,
  slotProperty?: string | null
): string | null {
  const name = getComponentName(component);

  if (!name) {
    return null;
  }

  const propsArray = Object.entries(args)
    .filter(([k]) => k !== slotProperty)
    .map(([k, v]) => toSvelteProperty(k, v, argTypes))
    .filter((p) => p);

  const props = propsArray.join(' ');

  const multiline = props.length > 50;
  const slotValue = slotProperty ? args[slotProperty] : null;

  const srcStart = multiline ? `<${name}\n  ${propsArray.join('\n  ')}` : `<${name} ${props}`;
  if (slotValue) {
    return `${srcStart}>\n    ${slotValue}\n</${name}>`;
  }
  return `${srcStart}/>`;
}

/**
 * Check if the story component is a wrapper to the real component.
 *
 * A component can be annotated with @wrapper to indicate that
 * it's just a wrapper for the real tested component. If it's the case
 * then the code generated references the real component, not the wrapper.
 *
 * moreover, a wrapper can annotate a property with @slot : this property
 * is then assumed to be an alias to the default slot.
 *
 * @param component Component
 */
function getWrapperProperties(
  component?: SvelteStoryResult['Component'] & {
    __docgen?: SvelteComponentDoc & { keywords?: string[] };
  }
) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { __docgen } = component || {};
  if (!__docgen) {
    return { wrapper: false };
  }

  // the component should be declared as a wrapper
  if (!__docgen.keywords?.find((kw: any) => kw.name === 'wrapper')) {
    return { wrapper: false };
  }

  const slotProp = __docgen.data?.find((prop: any) =>
    prop.keywords.find((kw: any) => kw.name === 'slot')
  );
  return { wrapper: true, slotProperty: slotProp?.name as string };
}

/**
 * Svelte source decorator.
 * @param storyFn Fn
 * @param context  StoryContext
 */
export const sourceDecorator: DecoratorFunction<SvelteRenderer> = (storyFn, context) => {
  const channel = addons.getChannel();
  const skip = skipSourceRender(context);
  const story = storyFn();

  let source: string;

  useEffect(() => {
    if (!skip && source) {
      const { id, unmappedArgs } = context;
      channel.emit(SNIPPET_RENDERED, { id, args: unmappedArgs, source });
    }
  });

  if (skip) {
    return story;
  }

  const { parameters = {}, args = {}, component: ctxComponent } = context || {};

  // excludeDecorators from source generation as they'll generate the wrong code
  // instead get the component directly from the original story function instead
  let { Component: component } = (context.originalStoryFn as ArgsStoryFn<SvelteRenderer>)(
    args,
    context
  );
  const { wrapper, slotProperty } = getWrapperProperties(component);
  if (wrapper) {
    if (parameters.component) {
      deprecate('parameters.component is deprecated. Using context.component instead.');
    }

    component = ctxComponent;
  }

  const generated = generateSvelteSource(component, args, context?.argTypes, slotProperty);
  if (generated) {
    source = generated;
  }

  return story;
};
