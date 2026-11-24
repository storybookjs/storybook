/*! Bundled license information:

@scope/package/index.js:
  (c) Somebody
  @license MIT
*/
const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  }@media (hover: none) { a { color: red; } }
`;

globalThis.result = css.includes('@keyframes');
