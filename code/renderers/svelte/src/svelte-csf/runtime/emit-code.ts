import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';
import { SourceType, SNIPPET_RENDERED } from '@storybook/docs-tools';
import { addons } from '@storybook/preview-api';
import get from 'lodash-es/get';

type Params = {
  args: StoryObj['args'];
  storyContext: StoryContext;
};

const channel: ReturnType<(typeof addons)['getChannel']> | undefined = addons.getChannel();

/**
 * Given a code string representing the raw source code for the story,
 * and the current, dynamic args
 * this function:
 * 1. Replaces args references in the code with the actual values
 * 2. Emits the final code to Storybook's internal code provider
 * So that it can be shown in source code viewer
 */
export const emitCode = (params: Params) => {
  const { storyContext } = params;

  if (skipSourceRender(storyContext)) {
    return;
  }

  const codeToEmit = generateCodeToEmit({
    code: storyContext.parameters.__svelteCsf.rawCode,
    args: params.args,
  });

  // Using setTimeout here to ensure we're emitting after the base @storybook/svelte emits its version of the code
  // TODO: fix this in @storybook/svelte, don't emit when using stories.svelte files
  setTimeout(() => {
    channel.emit(SNIPPET_RENDERED, {
      id: storyContext.id,
      args: storyContext.unmappedArgs,
      source: codeToEmit,
    });
  });
};

// Copied from @storybook/svelte at https://github.com/storybookjs/storybook/blob/17b7512c60256c739b890b3d85aaac992806dee6/code/renderers/svelte/src/docs/sourceDecorator.ts#L16-L33
const skipSourceRender = (context: Params['storyContext']) => {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;
  const rawCode = context?.parameters.__svelteCsf.rawCode;

  if (!rawCode) {
    return true;
  }

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
};

export const generateCodeToEmit = ({ code, args }: { code: string; args: StoryObj['args'] }) => {
  const allPropsArray = Object.entries(args ?? {})
    .map(([argKey, argValue]) => argsToProps(argKey, argValue))
    .filter((p) => p);

  let allPropsString = allPropsArray.join(' ');
  // make the props multiline if the string is longer than 50 chars
  // TODO: do this at the final stage instead, taking into account the singular args replacements
  if (allPropsString.length > 50) {
    // TODO: the indendation only works if it's in the root-level component. In a nested component, the indentation will be too shallow
    allPropsString = `\n  ${allPropsArray.join('\n  ')}\n`;
  }

  let codeToEmit = code
    .replaceAll('{...args}', allPropsString)
    // replace single arg references with their actual value, eg. myProp={args.something} => myProp="actual"
    .replace(/([\w\d_$]*)=\{(args[\w\d_$\.]*)\}*/g, (_, key, argPath) => {
      const value = get({ args }, argPath);
      return argsToProps(key, value) ?? '';
    });
  // TODO: also replace direct references, eg. <h1>{args.heading}</h1>
  // TODO: support optional chaining syntax, eg. <h1>{args.texts?.h1}</h1>

  return codeToEmit;
};

/**
 * convert a {key: value} pair into Svelte attributes, eg. {someKey: "some string"} => someKey="some string"
 */
const argsToProps = (key: string, value: any): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (value === true) {
    return key;
  }

  if (typeof value === 'string') {
    return `${key}=${JSON.stringify(value)}`;
  }

  if (typeof value === 'function') {
    return `${key}={${value.getMockName?.() ?? value.name ?? '() => {}'}}`;
  }

  return `${key}={${JSON.stringify(value, null, 1)
    .replace(/\n/g, '')
    // Find "}" or "]" at the end of the string, not preceded by a space, and add a space
    .replace(/(?<!\s)([}\]])$/, ' $1')}}`;
};
