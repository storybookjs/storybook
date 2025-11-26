type Props = {
  id: string;
  fontFaceCSS: string;
  classNamesCSS: string;
};

export function setFontDeclarationsInHead({ id, fontFaceCSS, classNamesCSS }: Props) {
  return `
    if (!document.getElementById('id-${id}')) {
      const fontDeclarations = \`${fontFaceCSS}\`;
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
