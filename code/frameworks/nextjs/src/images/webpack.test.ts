import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import webpack, { type Configuration as WebpackConfig } from 'webpack';

import { configureImages } from './webpack.ts';

vi.mock('../utils.ts', () => ({
  getNextjsVersion: () => '15.0.0',
}));

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

const getImageLoaderAlias = (nextConfig: NextConfig = {}) => {
  const baseConfig: WebpackConfig = {
    module: { rules: [] },
    resolve: { alias: {} },
  };

  configureImages(baseConfig, nextConfig);

  return (baseConfig.resolve?.alias as Record<string, string>)['@storybook/nextjs/image-loader'];
};

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
    tempDir = await mkdtemp(join(tmpdir(), 'storybook-nextjs-image-loader-'));
    const entryFile = join(tempDir, 'entry.ts');
    const loaderFile = join(tempDir, 'image-loader.ts');
    const helperFile = join(tempDir, 'loader-helper.ts');
    const outputPath = join(tempDir, 'dist');
    const outputFile = join(outputPath, 'bundle.cjs');

    await Promise.all([
      writeFile(
        entryFile,
        `
          import imageLoader from '@storybook/nextjs/image-loader';

          export default imageLoader({ src: '/hero.png', width: 640, quality: 80 });
        `
      ),
      writeFile(
        loaderFile,
        `
          import type { ImageLoaderProps } from 'next/image';

          import { prefix } from './loader-helper.ts';

          export default function customLoader({ src, width }: ImageLoaderProps) {
            return \`\${prefix}\${src}?w=\${width}\`;
          }
        `
      ),
      writeFile(helperFile, `export const prefix = 'custom:';`),
    ]);

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
      webpack(config, (error, stats) => {
        if (error) {
          reject(error);
        } else if (stats?.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
        } else {
          resolve();
        }
      });
    });

    const result = createRequire(import.meta.url)(outputFile) as { default: string };

    expect(result.default).toBe('custom:/hero.png?w=640');
  });
});
