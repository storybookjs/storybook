const previewRuntimeEntry =
  /^import \{([^}]+)\} from ("\.\/_chunks\/[^"]+");\r?\n([\w$]+)\(\);\r?\nexport \{ ([\w$]+) \};\r?\n?$/;

// Bundlers drop the top-level init call because this package is side-effect free, so the export runs it too.
export function tiePreviewRuntimeSetup(source: string): string {
  const match = source.match(previewRuntimeEntry);
  if (!match) {
    throw new Error('Unexpected preview runtime entry');
  }

  const [, specifiers, from, initName, setupName] = match;
  const initSpecifier = specifiers
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.endsWith(` as ${initName}`));
  if (!initSpecifier || setupName !== 'setup') {
    throw new Error('Unexpected preview runtime entry');
  }

  return `import { ${initSpecifier} } from ${from};\n${initName}();\nfunction setup() {\n  ${initName}();\n}\nexport { setup };\n`;
}
