import { SourceType, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons } from 'storybook/internal/preview-api';
import type { StoryObj } from '@storybook/svelte';
import { get } from 'es-toolkit/compat';

import type { StoryContext } from '../types.ts';

type Params = {
  args: Record<string, any>;
  storyContext: StoryContext<Record<string, any>>;
};

const channel: ReturnType<(typeof addons)['getChannel']> | undefined = addons.getChannel();

// Emits the story's Svelte source, with `args` references replaced by their current values, to the docs source viewer.
export const emitCode = (params: Params) => {
  if (globalThis.FEATURES?.docgenServer) return;
  const { storyContext } = params;

  if (skipSourceRender(storyContext)) {
    return;
  }

  const codeToEmit = generateCodeToEmit({
    code: storyContext.parameters.__svelteCsf.rawCode,
    args: params.args,
  });

  // The source decorator also emits a snippet for `.stories.svelte` stories, so emit after it to replace it.
  setTimeout(() => {
    channel.emit(SNIPPET_RENDERED, {
      id: storyContext.id,
      args: storyContext.unmappedArgs,
      source: codeToEmit,
    });
  });
};

// Same rules as `skipSourceRender` in `docs/sourceDecorator.ts`
const skipSourceRender = (context: Params['storyContext']) => {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;
  const rawCode = context?.parameters.__svelteCsf?.rawCode;

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
  // check if children is used in the template (e.g., {args.children})
  // if so, we should exclude it from the props to avoid it appearing twice
  const childrenUsedInTemplate = /\bargs\??\.children\b/.test(code);

  const allPropsArray = Object.entries(args ?? {})
    .map(([argKey, argValue]) => {
      // skip children if it's used in the template content (slot)
      if (childrenUsedInTemplate && argKey === 'children') {
        return null;
      }
      return argsToProps(argKey, argValue);
    })
    .filter((p) => p);

  let allPropsString = allPropsArray.join(' ');
  // make the props multiline if the string is longer than 50 chars, not counting single arg replacements
  if (allPropsString.length > 50) {
    // The indentation is right only for a root-level component; in a nested one it is too shallow.
    allPropsString = `\n  ${allPropsArray.join('\n  ')}\n`;
  }

  const codeToEmit = code
    .replaceAll('{...args}', allPropsString)
    // replace text expressions that reference a string arg with the plain text,
    // eg. <Button>{args.children}</Button> => <Button>Click me</Button>
    // attribute values like prop={args.something} are skipped
    .replace(/(?<!=)\{\s*(args(?:[\w\d_$.?[\]"'])+)\s*\}/g, (match, argPath: string) => {
      const value = get({ args }, argPath.replaceAll('?', ''));
      return isPlainText(value) ? value : match;
    })
    // replace single arg references with their actual value,
    // eg. myProp={args.something} => myProp={"actual"}
    // or <h1>{args.something}</h1> => <h1>"actual"</h1>
    .replace(/args(?:[\w\d_$.?[\]"'])+/g, (argPath) => {
      const path = argPath.replaceAll('?', ''); // remove optional chaining character
      const value = get({ args }, path);
      return valueToString(value);
    });

  return codeToEmit;
};

// Svelte reads `{}<>"\&` as markup, an expression or an entity
const isPlainText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !/[{}<>"\\&]/.test(value);

type MockableFunction = ((...args: any[]) => any) & {
  getMockName?: () => string;
};

const getFunctionName = (fn: MockableFunction) => {
  const name = fn.getMockName?.() ?? fn.name;
  if (name && name !== 'spy') {
    return name;
  }
  return '() => {}';
};

const valueToString = (value: any): string => {
  if (typeof value === 'object' && value !== null && value[Symbol.for('svelte.snippet')]) {
    return 'snippet';
  }

  if (typeof value === 'function') {
    return getFunctionName(value);
  }

  return (
    JSON.stringify(value, null, 1)
      ?.replace(/\n/g, '')
      // Find "}" or "]" at the end of the string, not preceded by a space, and add a space
      .replace(/(?<!\s)([}\]])$/, ' $1')
  );
};

const argsToProps = (key: string, value: any): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (value === true) {
    return key;
  }

  const stringValue = valueToString(value);

  if (typeof value === 'string') {
    return `${key}=${stringValue}`;
  }

  return `${key}={${stringValue}}`;
};
