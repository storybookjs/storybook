import * as fs from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { fs as memfs, vol } from 'memfs';
import type { NextConfig } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import webpack, { type Configuration as WebpackConfig } from 'webpack';

import { getNextjsVersion } from '../utils.ts';
import { configureImages } from './webpack.ts';

vi.mock('../utils.ts', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(getNextjsVersion).mockReturnValue('15.0.0');
});

const getImageLoaderAlias = (nextConfig: NextConfig = {}) => {
  const baseConfig: WebpackConfig = {
    module: { rules: [] },
    resolve: { alias: {} },
  };

  configureImages(baseConfig, nextConfig);

  return (baseConfig.resolve?.alias as Record<string, string>)['@storybook/nextjs/image-loader'];
};

const createWebpackInputFileSystem = (virtualRoot: string) =>
  new Proxy(fs, {
    get(target, property, receiver) {
      const diskImplementation = Reflect.get(target, property, receiver);
      const memoryImplementation = Reflect.get(memfs, property);

      if (typeof diskImplementation !== 'function' || typeof memoryImplementation !== 'function') {
        return diskImplementation;
      }

      return (...args: unknown[]) => {
        const filePath = args[0];
        const isVirtualPath =
          typeof filePath === 'string' &&
          (filePath === virtualRoot || filePath.startsWith(`${virtualRoot}${sep}`));
        const implementation = isVirtualPath ? memoryImplementation : diskImplementation;
        const implementationContext = isVirtualPath ? memfs : target;

        return Reflect.apply(implementation, implementationContext, args);
      };
    },
  });

describe('configureImages', () => {
  it('aliases the image loader to the Storybook default', () => {
    const defaultLoader = fileURLToPath(import.meta.resolve('@storybook/nextjs/image-loader'));

    expect(getImageLoaderAlias()).toBe(defaultLoader);
    expect(getImageLoaderAlias({ images: { loaderFile: '' } })).toBe(defaultLoader);
  });

  it('aliases the image loader to the custom loader file from the Next.js config', () => {
    const loaderFile = 'C:\\projects\\example\\src\\image-loader.ts';

    expect(getImageLoaderAlias({ images: { loaderFile } })).toBe(loaderFile);
  });

  it('lets webpack compile a TypeScript custom loader and its imports', async () => {
    const virtualRoot = resolve('.storybook-nextjs-image-loader-test');
    const entryFile = join(virtualRoot, 'entry.ts');
    const loaderFile = join(virtualRoot, 'image-loader.ts');
    const helperFile = join(virtualRoot, 'loader-helper.ts');
    const outputPath = join(virtualRoot, 'dist');
    const outputFile = join(outputPath, 'bundle.cjs');

    vol.fromJSON({
      [entryFile]: `
          import imageLoader from '@storybook/nextjs/image-loader';

          export default imageLoader({ src: '/hero.png', width: 640, quality: 80 });
        `,
      [loaderFile]: `
          import type { ImageLoaderProps } from 'next/image';

          import { prefix } from './loader-helper.ts';

          export default function customLoader({ src, width }: ImageLoaderProps) {
            return \`\${prefix}\${src}?w=\${width}\`;
          }
        `,
      [helperFile]: `export const prefix = 'custom:';`,
    });

    const config: WebpackConfig = {
      mode: 'production',
      target: 'node',
      devtool: false,
      entry: entryFile,
      output: {
        path: outputPath,
        filename: 'bundle.cjs',
        library: { type: 'commonjs2' },
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: {
              loader: fileURLToPath(import.meta.resolve('babel-loader')),
              options: {
                presets: [fileURLToPath(import.meta.resolve('@babel/preset-typescript'))],
              },
            },
          },
        ],
      },
      resolve: {
        alias: {},
        extensions: ['.ts', '.js'],
      },
      optimization: {
        minimize: false,
      },
    };

    configureImages(config, { images: { loaderFile } });

    await new Promise<void>((resolve, reject) => {
      const compiler = webpack(config);
      compiler.inputFileSystem = createWebpackInputFileSystem(
        virtualRoot
      ) as typeof compiler.inputFileSystem;
      compiler.outputFileSystem = memfs as typeof compiler.outputFileSystem;

      compiler.run((error, stats) => {
        compiler.close((closeError) => {
          if (error || closeError) {
            reject(error ?? closeError);
          } else if (stats?.hasErrors()) {
            reject(new Error(stats.toString({ all: false, errors: true })));
          } else {
            resolve();
          }
        });
      });
    });

    const bundle = memfs.readFileSync(outputFile, 'utf8') as string;
    const module = { exports: {} };
    runInNewContext(bundle, { module, exports: module.exports });
    const result = module.exports as { default: string };

    expect(result.default).toBe('custom:/hero.png?w=640');
  });
});
