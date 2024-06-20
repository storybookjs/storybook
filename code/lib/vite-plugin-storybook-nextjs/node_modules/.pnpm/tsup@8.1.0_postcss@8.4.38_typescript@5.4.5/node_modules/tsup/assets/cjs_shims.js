// Shim globals in cjs bundle
// There's a weird bug that esbuild will always inject importMetaUrl
// if we export it as `const importMetaUrl = ... __filename ...`
// But using a function will not cause this issue

const getImportMetaUrl = () =>
  typeof document === 'undefined'
    ? new URL('file:' + __filename).href
    : (document.currentScript && document.currentScript.src) ||
      new URL('main.js', document.baseURI).href

export const importMetaUrl = /* @__PURE__ */ getImportMetaUrl()
