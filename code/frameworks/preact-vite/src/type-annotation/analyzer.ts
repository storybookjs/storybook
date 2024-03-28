import type { FrameworkPlugin } from '@previewjs/core';
import { setupFrameworkPlugin } from '@previewjs/core';
import preactFrameworkPlugin from '@previewjs/plugin-preact';
import type { TypeAnalyzer } from '@previewjs/type-analyzer';
import { createTypeAnalyzer } from '@previewjs/type-analyzer';
import type { Reader } from '@previewjs/vfs';
import { createFileSystemReader } from '@previewjs/vfs';
import type { SBType } from '@storybook/types';
import { convertToStorybook } from './conversion';

export const create = (options: { rootDir: string }) => {
  const analyzer = {
    async analyze(fileName: string): Promise<{ name: string; args: SBType }[]> {
      const components = await frameworkPlugin.detectComponents(reader, typeAnalyzer, [fileName]);
      const results: { name: string; args: any }[] = [];

      for (const component of components) {
        if (component.info.kind === 'story') {
          const detectedType = (await component.info?.associatedComponent?.analyze())?.propsType;
          if (detectedType) {
            results.push({
              name: component.name,
              args: convertToStorybook(detectedType),
            });
          }
        } else {
          const detectedType = (await component.info?.analyze())?.propsType;
          if (detectedType) {
            results.push({
              name: component.name,
              args: convertToStorybook(detectedType),
            });
          }
        }
      }
      return results;
    },
  };

  let typeAnalyzer: TypeAnalyzer;
  let frameworkPlugin: FrameworkPlugin;
  let reader: Reader;

  const init = async () => {
    if (!reader) {
      reader = createFileSystemReader();
    }
    if (!typeAnalyzer) {
      typeAnalyzer = createTypeAnalyzer({
        rootDirPath: options.rootDir,
        reader,
      });
    }
    if (!frameworkPlugin) {
      // @ts-expect-error (not type-safe)
      frameworkPlugin = await setupFrameworkPlugin({
        rootDirPath: options.rootDir,
        frameworkPluginFactories: [preactFrameworkPlugin],
      });
    }
  };

  return { analyzer, init };
};
