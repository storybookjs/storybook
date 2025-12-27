import { basename } from 'node:path';

import { getRefs } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { executor, getConfig } from '../index';
import { readTemplate } from './template';

/**
 * Extracts the base path from viteFinal configuration. Only returns a custom base if explicitly set
 * and not default values. This ensures backward compatibility for users who don't set a base.
 */
async function getManagerBase(options: Options): Promise<string> {
  try {
    // Try to get the viteFinal configuration to extract the base
    const viteConfig = (await options.presets.apply('viteFinal', {}, options)) as
      | { base?: string }
      | undefined;
    const viteBase = viteConfig?.base;

    // Only use custom base if it's explicitly set and not a default value
    if (viteBase && viteBase !== '/' && viteBase !== './') {
      // Ensure base ends with a trailing slash for proper path concatenation
      return viteBase.endsWith('/') ? viteBase : `${viteBase}/`;
    }
  } catch {
    // viteFinal may not be available (e.g., webpack builder), fall back to default
  }

  return './';
}

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
  const [instance, config, base] = await Promise.all([
    //
    executor.get(),
    getConfig(options),
    getManagerBase(options),
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
    base,
  };
};
