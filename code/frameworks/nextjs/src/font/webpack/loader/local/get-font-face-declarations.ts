import { dirname, join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

import { validateLocalFontFunctionCall } from 'next/dist/compiled/@next/font/dist/local/validate-local-font-function-call';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import loaderUtils from 'next/dist/compiled/loader-utils3';

import type { LoaderOptions } from '../types';

type LocalFontSrc = string | Array<{ path: string; weight?: string; style?: string }>;

export async function getFontFaceDeclarations(
  options: LoaderOptions,
  rootContext: string,
  swcMode: boolean
) {
  const localFontSrc = options.props.src as LocalFontSrc;

  // Parent folder relative to the root context
  const parentFolder = swcMode
    ? dirname(join(getProjectRoot(), options.filename)).replace(rootContext, '')
    : dirname(options.filename).replace(rootContext, '');

  const {
    weight,
    style,
    variable,
    declarations = [],
  } = validateLocalFontFunctionCall('', options.props);

  const id = `font-${loaderUtils.getHashDigest(
    Buffer.from(JSON.stringify(localFontSrc)),
    'md5',
    'hex',
    6
  )}`;

  const fontDeclarations = declarations
    .map(({ prop, value }: { prop: string; value: string }) => `${prop}: ${value};`)
    .join('\n');

  const getFontFaceCSS = () => {
    if (typeof localFontSrc === 'string') {
      const localFontPath = join(parentFolder, localFontSrc).replaceAll('\\', '/');

      return `@font-face {
          font-family: ${id};
          src: url(.${localFontPath});
          ${fontDeclarations}
      }`;
    }
    return localFontSrc
      .map((font) => {
        const localFontPath = join(parentFolder, font.path).replaceAll('\\', '/');

        return `@font-face {
          font-family: ${id};
          src: url(.${localFontPath});
          ${font.weight ? `font-weight: ${font.weight};` : ''}
          ${font.style ? `font-style: ${font.style};` : ''}
          ${fontDeclarations}
        }`;
      })
      .join('');
  };

  return {
    id,
    fontFamily: id,
    fontFaceCSS: getFontFaceCSS(),
    weights: weight ? [weight] : [],
    styles: style ? [style] : [],
    variable,
  };
}
