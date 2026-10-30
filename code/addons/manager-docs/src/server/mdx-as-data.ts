import { readFile } from 'node:fs/promises';

export type MdxJsModule = {
  code: string;
  moduleType: 'js';
};

export function mdxFileFromId(id: unknown): string | undefined {
  if (typeof id !== 'string' || id.startsWith('\0')) {
    return undefined;
  }
  const file = id.split('?', 1)[0];
  if (!/\.mdx$/i.test(file)) {
    return undefined;
  }
  return file;
}

export function inertMdxModule(source: string): string {
  return `export default ${JSON.stringify(source)};`;
}

export function inertMdxJsModule(source: string): MdxJsModule {
  return { code: inertMdxModule(source), moduleType: 'js' };
}

export async function loadMdxModule(id: unknown): Promise<MdxJsModule | undefined> {
  const file = mdxFileFromId(id);
  if (!file) {
    return undefined;
  }
  return inertMdxJsModule(await readFile(file, 'utf8'));
}

export function managerDocsMdxPlugin() {
  return {
    name: 'storybook:manager-docs-mdx-data',
    enforce: 'pre' as const,
    load: loadMdxModule,
  };
}

type WebpackRuleConfig = {
  module?: {
    rules?: unknown[];
  };
};

export function addMdxSourceRule<Config extends WebpackRuleConfig>(
  config: Config
): Config & WebpackRuleConfig {
  if (!config.module) {
    config.module = {};
  }
  if (!config.module.rules) {
    config.module.rules = [];
  }
  config.module.rules.push({
    test: /\.mdx$/i,
    type: 'asset/source',
  });
  return config;
}
