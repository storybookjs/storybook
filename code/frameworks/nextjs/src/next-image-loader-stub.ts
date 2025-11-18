import { imageSize } from 'image-size';
import { interpolateName } from 'loader-utils';
import type { NextConfig } from 'next';
import type { RawLoaderDefinition } from 'webpack';

interface LoaderOptions {
  filename: string;
  nextConfig: NextConfig;
}

const nextImageLoaderStub: RawLoaderDefinition<LoaderOptions> = async function NextImageLoader(
  content: Uint8Array
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

  const { width, height } = imageSize(content);

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
