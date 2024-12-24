import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface PartialTSConfig {
  compilerOptions: {
    baseUrl?: string;
  };
}

const JSCONFIG = 'jsconfig.json';
const TSCONFIG = 'tsconfig.json';

export const getModulePath = (appDirectory: string): string[] => {
  // CRA only supports `jsconfig.json` if `tsconfig.json` doesn't exist.
  let configName = '';
  if (existsSync(join(appDirectory, TSCONFIG))) {
    configName = TSCONFIG;
  } else if (existsSync(join(appDirectory, JSCONFIG))) {
    configName = JSCONFIG;
  }

  try {
    const { baseUrl } = (require(join(appDirectory, configName)) as PartialTSConfig)
      .compilerOptions;
    return (baseUrl ? [baseUrl] : []) as string[];
  } catch (e) {
    return [];
  }
};
