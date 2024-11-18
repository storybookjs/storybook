import { validateLocalFontFunctionCall } from 'next/dist/compiled/@next/font/dist/local/validate-local-font-function-call.js';
// @ts-expect-error no types
import loaderUtils from 'next/dist/compiled/loader-utils3/index.js';
import { dedent } from 'ts-dedent';

type FontOrigin = { fontReferenceId?: string; fontPath: string };

export type LocalFontSrc =
  | FontOrigin
  | Array<{ path: FontOrigin; weight?: string; style?: string }>;

export type LoaderOptions = {
  /** Initial import name. Can be `next/font/google` or `next/font/local` */
  source: string;
  /** Props passed to the `next/font` function call */
  props: {
    src?: string | Array<{ path: string; weight?: string; style?: string }>;
    metaSrc?: LocalFontSrc;
  };
  /** Font Family name */
  fontFamily: string;
  /** Filename of the issuer file, which imports `next/font/google` or `next/font/local */
  filename: string;
};

/**
 * Returns a placeholder URL for a font reference
 *
 * @param refId - The reference ID of the font
 * @returns The placeholder URL
 */
export const getPlaceholderFontUrl = (refId: string) =>
  `__%%import.meta.ROLLUP_FILE_URL_${refId}%%__`;
/** Regular expression to match the placeholder URL */
getPlaceholderFontUrl.regexp = /__%%import\.meta\.ROLLUP_FILE_URL_(.*?)%%__/g;

export async function getFontFaceDeclarations(options: LoaderOptions) {
  const localFontSrc = options.props.metaSrc;

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
    if (localFontSrc) {
      if ('fontReferenceId' in localFontSrc) {
        return dedent`@font-face {
					font-family: ${id};
					src: url(${localFontSrc.fontReferenceId ? getPlaceholderFontUrl(localFontSrc.fontReferenceId) : `/@fs${localFontSrc.fontPath}`})
					${fontDeclarations}
				}`;
      }
      return (
        localFontSrc as Array<{
          path: FontOrigin;
          weight?: string;
          style?: string;
        }>
      )
        .map((font) => {
          return dedent`@font-face {
						font-family: ${id};
						src: url(${font.path.fontReferenceId ? getPlaceholderFontUrl(font.path.fontReferenceId) : `/@fs${font.path.fontPath}`});
						${font.weight ? `font-weight: ${font.weight};` : ''}
						${font.style ? `font-style: ${font.style};` : ''}
						${fontDeclarations}
					}`;
        })
        .join('');
    }

    return '';
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
