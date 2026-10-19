import { interpolateName } from 'loader-utils';
import type { NextConfig } from 'next';
import probeSync from 'probe-image-size/sync.js';
import type { RawLoaderDefinition } from 'webpack';

interface LoaderOptions {
  filename: string;
  nextConfig: NextConfig;
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

  this.emitFile(outputPath, content);

  if (nextConfig.images?.disableStaticImages) {
    return `const src = '${outputPath}'; export default src;`;
  }

  const size = probeSync(content as Buffer);

  // probe-image-size returns null instead of throwing on unrecognized data
  if (!size) {
    throw new Error('Unsupported or corrupt image file');
  }

  const { width, height } = size;

  return `export default ${JSON.stringify({
    src: outputPath,
    height,
    width,
    blurDataURL: outputPath,
  })};`;
};

nextImageLoaderStub.raw = true;

export default nextImageLoaderStub;
export const raw = true;
