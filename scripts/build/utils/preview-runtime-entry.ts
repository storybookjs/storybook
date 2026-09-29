// Bundlers drop the top-level init call because this package is side-effect free, so the export runs it too.
export function tiePreviewRuntimeSetup(source: string): string {
  const initName = source.match(/\r?\n(\w+)\(\);\r?\nexport \{ setup \};/)?.[1];
  const setupImport = source.match(/(\w+) as setup\b/)?.[1];
  if (!initName || !setupImport || !source.startsWith('import {')) {
    throw new Error('Unexpected preview runtime entry');
  }

  const withoutSetupImport = source
    .replace(new RegExp(String.raw`\b${setupImport} as setup,\s*`), '')
    .replace(new RegExp(String.raw`,\s*${setupImport} as setup\b`), '');
  if (withoutSetupImport.includes(' as setup')) {
    throw new Error('Unexpected preview runtime entry');
  }

  return withoutSetupImport.replace(
    'export { setup };',
    `function setup() {\n  ${initName}();\n}\nexport { setup };`
  );
}
