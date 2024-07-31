import { basename } from 'node:path';
import type { Options } from '@storybook/core/types';
import { getRefs } from '@storybook/core/common';

import { readTemplate } from './template';

import { executor, getConfig } from '../index';

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

  // we await these, because crucially if these fail, we want to bail out asap
  const [instance, config] = await Promise.all([
    //
    executor.get(),
    getConfig(options),
  ]);

  return {
    refs,
    features,
    title,
    docsOptions,
    template,
    customHead,
    instance,
    config,
    logLevel,
    favicon,
    tagsOptions,
  };
};
