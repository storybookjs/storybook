import { dedent } from 'ts-dedent';

import { getPlaceholderFontUrl } from '../local/get-font-face-declarations';

type Props = {
  id: string;
  fontFaceCSS: string;
  classNamesCSS: string;
};

export function setFontDeclarationsInHead({ id, fontFaceCSS, classNamesCSS }: Props) {
  // fontFaceCSS has placeholders for font path and fontReferenceId
  // I want to extract them
  const regex = new RegExp(getPlaceholderFontUrl.regexp);
  const fontPaths = fontFaceCSS.matchAll(regex);

  const fontPathsImportUrls = [];

  if (fontPaths) {
    for (const match of fontFaceCSS.matchAll(regex)) {
      fontPathsImportUrls.push({
        id: match[1],
        path: match[0].replaceAll(/__%%|%%__/g, ''),
      });
    }
  }

  return dedent`
  const fontPaths = [${fontPathsImportUrls.map((fontPath) => `{id: '${fontPath.id}', path: ${fontPath.path}}`).join(', ')}];
  if (!document.getElementById('id-${id}')) {
    let fontDeclarations = \`${fontFaceCSS}\`;
    fontPaths.forEach((fontPath, i) => {
      fontDeclarations = fontDeclarations.replace('__%%import.meta.ROLLUP_FILE_URL_' + fontPath.id + '%%__', fontPath.path.toString());
    });
    const style = document.createElement('style');
    style.setAttribute('id', 'font-face-${id}');
    style.innerHTML = fontDeclarations;
    document.head.appendChild(style);

    const classNamesCSS = \`${classNamesCSS}\`;
    const classNamesStyle = document.createElement('style');
    classNamesStyle.setAttribute('id', 'classnames-${id}');
    classNamesStyle.innerHTML = classNamesCSS;
    document.head.appendChild(classNamesStyle);
  }
`;
}
