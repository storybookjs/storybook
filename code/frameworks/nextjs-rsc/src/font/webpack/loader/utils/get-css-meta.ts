type Options = {
  fontFamily: string;
  styles: string[];
  weights: string[];
  fontFaceCSS: string;
  variable?: string;
};

export function getCSSMeta(options: Options) {
  const className = getClassName(options);
  const style = getStylesObj(options);
  const variableClassName = `__variable_${className}`;

  const classNamesCSS = `
    .${className} {
      font-family: ${options.fontFamily};
      ${isNextCSSPropertyValid(options.styles) ? `font-style: ${options.styles[0]};` : ''}
      ${isNextCSSPropertyValid(options.weights) ? `font-weight: ${options.weights[0]};` : ''}
    }

    ${
      options.variable
        ? `.${variableClassName} { ${options.variable}: '${options.fontFamily}'; }`
        : ''
    }
  `;

  const fontFaceCSS = `${changeFontDisplayToSwap(options.fontFaceCSS)}`;

  return {
    className,
    fontFaceCSS,
    classNamesCSS,
    style,
    ...(options.variable ? { variableClassName } : {}),
  };
}

function getClassName({ styles, weights, fontFamily }: Options) {
  const font = fontFamily.replaceAll(' ', '-').toLowerCase();
  const style = isNextCSSPropertyValid(styles) ? styles[0] : null;
  const weight = isNextCSSPropertyValid(weights) ? weights[0] : null;

  return `${font}${style ? `-${style}` : ''}${weight ? `-${weight}` : ''}`;
}

function getStylesObj({ styles, weights, fontFamily }: Options) {
  return {
    fontFamily,
    ...(isNextCSSPropertyValid(styles) ? { fontStyle: styles[0] } : {}),
    ...(isNextCSSPropertyValid(weights) ? { fontWeight: weights[0] } : {}),
  };
}

function isNextCSSPropertyValid(prop: string[]) {
  return prop.length === 1 && prop[0] !== 'variable';
}

/**
 * This step is necessary, because otherwise the font-display: optional; property blocks Storybook
 * from rendering the font, because the @font-face declaration is not loaded in time.
 */
function changeFontDisplayToSwap(css: string) {
  return css.replaceAll('font-display: optional;', 'font-display: block;');
}
