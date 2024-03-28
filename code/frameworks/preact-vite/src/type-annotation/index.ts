import { createUnplugin } from 'unplugin';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { ArgTypes, SBObjectType, SBType } from '@storybook/types';
import { createService } from './rpc';

const STORY_MATCHER = /\.(story|stories)\.[jt]sx?$/;

const defaultStoryMatcher = (id: string) => STORY_MATCHER.test(id);

interface PluginOptions {
  storyMatcher?: (name: string) => boolean;
  rootDir: string;
}

const formatArgTypes = ({ name, args }: { name: string; args: SBType }) => {
  const { value } = args as SBObjectType;
  if (!value) return '';
  const argTypes: ArgTypes = {};

  for (const [propName, type] of Object.entries(value)) {
    // mapping as per https://storybook.js.org/docs/7.0/react/essentials/controls#annotation
    if (type.name === 'boolean') {
      argTypes[propName] = { name: propName, type: 'boolean', control: 'boolean' };
    } else if (type.name === 'number') {
      argTypes[propName] = { name: propName, type: 'number', control: { type: 'number' } };
    } else if (type.name === 'string') {
      argTypes[propName] = { name: propName, type: 'string', control: { type: 'text' } };
    } else {
      argTypes[propName] = { name: propName, control: 'object' };
    }
  }
  return `
${name}.argTypes = {
  ...${JSON.stringify(argTypes, null, 2)},
  ...(${name}.argTypes ?? {})
};
`;
};

const plugin = createUnplugin<PluginOptions>((options) => {
  const worker = new Worker(join(__dirname, 'type-annotation/worker.mjs'), {
    workerData: { rootDir: options.rootDir },
  });
  const service = createService(worker);

  return {
    name: 'unplugin-preact-addon-docs',
    transformInclude(id) {
      return (options?.storyMatcher ?? defaultStoryMatcher)(id);
    },
    async transform(code, id) {
      const components = await service.analyze(id);
      return `${code}

;// generated argTypes from plugin
${components.map(formatArgTypes).join('\n')}
`;
    },
  };
});

export const { esbuild, webpack, vite, rollup } = plugin;
