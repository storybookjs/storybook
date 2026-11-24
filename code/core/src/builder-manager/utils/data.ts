import { basename } from 'node:path';

import { getRefs } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getConfig } from '../index.ts';
import { readTemplate } from './template.ts';

export const getData = async (options: Options) => {
  const refs = getRefs(options);
  const favicon = options.presets.apply<string>('favicon').then((p) => basename(p));

  const features = options.presets.apply<Record<string, string | boolean>>('features');
  const logLevel = options.presets.apply<string>('logLevel');
  const title = options.presets.apply<string>('title');
  const docsOptions = options.presets.apply('docs', {});
  const tagsOptions = options.presets.apply('tags', {});
  const template = readTemplate('template.ejs');
  const customHead = options.presets.apply<string>('managerHead');

  // awaited here, because a failure must stop the build before anything else starts
  const config = await getConfig(options);

  return {
    refs,
    features,
    title,
    docsOptions,
    template,
    customHead,
    config,
    logLevel,
    favicon,
    tagsOptions,
  };
};
