/** Builder-owned parts of the preview page. */
export interface PreviewHtmlSlots {
  /** Tags that load the preview entry, rendered last in the body. */
  scripts: string;
  /** Markup appended to the head, such as stylesheet links or a favicon. */
  head?: string;
  /** Module mocker runtime URL; rendered only when the project has a preview config. */
  mockerRuntimeUrl?: string;
}

/** Describe the content core places on the preview page. */
export interface PreviewHtmlInput {
  /** Values assigned to `window` before any preview code runs; `undefined` values are omitted. */
  globals: Record<string, unknown>;
  headHtmlSnippet?: string;
  bodyHtmlSnippet?: string;
  mockerRuntime: boolean;
}

const FONT_FACES = [
  ['normal', 400, 'regular'],
  ['italic', 400, 'italic'],
  ['normal', 700, 'bold'],
  ['italic', 700, 'bold-italic'],
] as const;

/** Render `iframe.html` from core's content and the builder's slots. */
export function renderPreviewHtml(input: PreviewHtmlInput, slots: PreviewHtmlSlots): string {
  const mocker =
    input.mockerRuntime && slots.mockerRuntimeUrl
      ? `\n    <script type="module" src="${slots.mockerRuntimeUrl}"></script>`
      : '';
  const fontFaces = FONT_FACES.map(
    ([style, weight, file]) => `
      @font-face {
        font-family: 'Nunito Sans';
        font-style: ${style};
        font-weight: ${weight};
        font-display: swap;
        src: url('./sb-common-assets/nunito-sans-${file}.woff2') format('woff2');
      }`
  ).join('\n');
  const globals = Object.entries(input.globals)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `      window[${JSON.stringify(key)}] = ${toScriptJson(value)};`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />${mocker}
    <title>Storybook</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <style>${fontFaces}

      #storybook-root[hidden],
      #storybook-docs[hidden] {
        display: none !important;
      }
    </style>

    <script>
${globals}

      // Disable "module && module.hot" checks in Storybook source code.
      window.module = undefined;
      window.global = window;
    </script>
${indent(input.headHtmlSnippet)}${indent(slots.head)}  </head>

  <body>
${indent(input.bodyHtmlSnippet)}    <div id="storybook-root"></div>
    <div id="storybook-docs"></div>
${indent(slots.scripts)}  </body>
</html>
`;
}

// Escape `<` so a serialized value cannot close the script element.
function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function indent(html: string | undefined): string {
  return html ? `    ${html.trim()}\n` : '';
}
