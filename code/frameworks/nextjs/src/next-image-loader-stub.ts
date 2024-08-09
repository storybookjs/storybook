import { NextJsSharpError } from 'storybook/internal/preview-errors';

import imageSizeOf from 'image-size';
import { interpolateName } from 'loader-utils';
import type { NextConfig } from 'next';
import { cpus } from 'os';
import type { RawLoaderDefinition } from 'webpack';

interface LoaderOptions {
  filename: string;
  nextConfig: NextConfig;
}

let sharp: typeof import('sharp') | undefined;

try {
  sharp = require('sharp');
  if (sharp && sharp.concurrency() > 1) {
    // Reducing concurrency reduces the memory usage too.
    const divisor = process.env.NODE_ENV === 'development' ? 4 : 2;
    sharp.concurrency(Math.floor(Math.max(cpus().length / divisor, 1)));
  }
} catch (e) {
  console.warn(
    'You have to install sharp in order to use image optimization features in Next.js. AVIF support is also disabled.'
  );
}

const nextImageLoaderStub: RawLoaderDefinition<LoaderOptions> = async function NextImageLoader(
  content
) {
  const { filename, nextConfig } = this.getOptions();
  const opts = {
    context: this.rootContext,
    content,
  };
  const outputPath = interpolateName(this, filename.replace('[ext]', '.[ext]'), opts);
  const extension = interpolateName(this, '[ext]', opts);

  this.emitFile(outputPath, content);

  if (nextConfig.images?.disableStaticImages) {
    return `const src = '${outputPath}'; export default src;`;
  }

  let width;
  let height;

  if (extension === 'avif') {
    if (sharp) {
      const transformer = sharp(content);
      const result = await transformer.metadata();
      width = result.width;
      height = result.height;
    } else {
      throw new NextJsSharpError();
    }
  } else {
    const result = imageSizeOf(this.resourcePath);
    width = result.width;
    height = result.height;
  }

  return `export default ${JSON.stringify({
    src: outputPath,
    height,
    width,
    blurDataURL: outputPath,
  })};`;
};

nextImageLoaderStub.raw = true;

export = nextImageLoaderStub;
