import type * as _NextImage from 'next/image';

export const defaultLoader = ({ src, width, quality = 75 }: _NextImage.ImageLoaderProps) => {
  const missingValues = [];
  if (!src) {
    missingValues.push('src');
  }

  if (!width) {
    missingValues.push('width');
  }

  if (missingValues.length > 0) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      `Next Image Optimization requires ${missingValues.join(
        ', '
      )} to be provided. Make sure you pass them as props to the \`next/image\` component. Received: ${JSON.stringify(
        {
          src,
          width,
          quality,
        }
      )}`
    );
  }

  const url = new URL(src, window.location.href);

  if (!url.searchParams.has('w') && !url.searchParams.has('q')) {
    url.searchParams.set('w', width.toString());
    url.searchParams.set('q', quality.toString());
  }

  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return url.toString().slice(url.origin.length);
  }

  return url.toString();
};
