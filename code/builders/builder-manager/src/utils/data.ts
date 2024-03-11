import { basename } from 'path';
import type { Options } from '@storybook/types';
import { getRefs } from '@storybook/core-common';

import { readTemplate } from './template';
// eslint-disable-next-line import/no-cycle
import { executor, getConfig } from '../index';

export const getData = async (options: Options) => {
  const refs = getRefs(options);
  const favicon = options.presets.apply('favicon').then((p) => basename(p));

  const features = options.presets.apply('features');
  const logLevel = options.presets.apply('logLevel');
  const title = options.presets.apply('title');
  const docsOptions = options.presets.apply('docs', {});
  const template = readTemplate('template.ejs');
  const customHead = options.presets.apply('managerHead');

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
  };
};
