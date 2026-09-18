const css = `
:host {
  font-family: "Nunito Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 700;
  border: 0;
  border-radius: 3em;
  cursor: pointer;
  display: inline-block;
  line-height: 1;
  color: white;
  background-color: tomato;
  font-size: 14px;
  padding: 11px 20px;
}
:host(:hover) {
  text-decoration: underline;
}
:host(:focus) {
  box-shadow: inset 0 0 0 2px maroon;
  outline: 0;
}
:host(:active) {
  background-color: firebrick;
}
`;

export class CustomElement extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });

    if (shadow.adoptedStyleSheets !== undefined) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [sheet];
    } else {
      const style = document.createElement('style');
      style.textContent = css;
      shadow.append(style);
    }

    shadow.append(document.createElement('slot'));
  }
}

window.customElements.define('custom-element', CustomElement);
