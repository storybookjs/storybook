// Vite's dev output addresses modules by root-absolute path. The import map keeps every import
// under `base`, and the script tags it cannot reach (`src` is not an import specifier) are prefixed.
export function rebaseIframeHtml(html: string, base: string) {
  const importMap = JSON.stringify({ imports: { '/': base, [base]: base } });
  return html
    .replace(/<head(\s[^>]*)?>/, `$&\n    <script type="importmap">${importMap}</script>`)
    .replace(/(<script\b[^>]*\ssrc=")\/(?!\/)/g, `$1${base}`);
}
