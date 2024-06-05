import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';
import { SourceType, SNIPPET_RENDERED } from '@storybook/docs-tools';
import { addons } from '@storybook/preview-api';

type Params<TMeta extends Meta> = {
  code: string;
  args: StoryObj<TMeta>['args'];
  storyContext: StoryContext<TMeta['args']>;
};

const channel: ReturnType<(typeof addons)['getChannel']> | undefined = addons.getChannel()

export const emitCode = <TMeta extends Meta>(params: Params<TMeta>) => {
  const { storyContext } = params;

  if (skipSourceRender(storyContext)) {
    return;
  }

  const codeToEmit = generateCodeToEmit(params);

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

// Copy from X
const skipSourceRender = (context: Params<Meta>['storyContext']) => {
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

export const generateCodeToEmit = ({ code, args }: Params<Meta>) => {
  const allPropsArray = Object.entries(args ?? {})
    .map(([argKey, argValue]) => argsToProps(argKey, argValue))
    .filter((p) => p);

  let allPropsString = allPropsArray.join(' ');
  // make the props multiline if the string is longer than 50 chars
  if (allPropsString.length > 50) {
    allPropsString = allPropsArray.join('\n  ');
  }

  let codeToEmit = code.replaceAll('{...args}', allPropsString);
  // TODO: replace singular args too.

  return codeToEmit;
};

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

  // TODO: add space at the end of objects, multiline long values
  return `${key}={${JSON.stringify(value, null, 1).replace(/\n/g, '')}}`;
};
