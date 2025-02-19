import * as fs from 'node:fs/promises';

import { findUp } from 'find-up';

import * as babel from '../../../../../../core/src/babel';
import { type Check, CompatibilityType } from './index';

interface Declaration {
  type: string;
}
interface CallExpression extends Declaration {
  type: 'CallExpression';
  callee: { type: 'Identifier'; name: string };
  arguments: Declaration[];
}
interface ObjectExpression extends Declaration {
  type: 'ObjectExpression';
  properties: { type: 'Property'; key: { name: string }; value: Declaration }[];
}
interface ArrayExpression extends Declaration {
  type: 'ArrayExpression';
  elements: any[];
}
interface StringLiteral extends Declaration {
  type: 'StringLiteral';
  value: any;
}

const isCallExpression = (path: Declaration): path is CallExpression =>
  path?.type === 'CallExpression';

const isObjectExpression = (path: Declaration): path is ObjectExpression =>
  path?.type === 'ObjectExpression';

const isArrayExpression = (path: Declaration): path is ArrayExpression =>
  path?.type === 'ArrayExpression';

const isStringLiteral = (path: Declaration): path is StringLiteral =>
  path?.type === 'StringLiteral';

const isWorkspaceConfigArray = (path: Declaration) =>
  isArrayExpression(path) &&
  path?.elements.every((el: any) => isStringLiteral(el) || isObjectExpression(el));

const isDefineWorkspaceExpression = (path: Declaration) =>
  isCallExpression(path) &&
  path.callee.name === 'defineWorkspace' &&
  isWorkspaceConfigArray(path.arguments[0]);

const isDefineConfigExpression = (path: Declaration) =>
  isCallExpression(path) &&
  path.callee.name === 'defineConfig' &&
  isObjectExpression(path.arguments[0]);

const isSafeToExtendWorkspace = (path: CallExpression) =>
  isObjectExpression(path.arguments[0]) &&
  path.arguments[0]?.properties.every(
    (p) =>
      p.key.name !== 'test' ||
      (isObjectExpression(p.value) &&
        p.value.properties.every(
          ({ key, value }) => key.name !== 'workspace' || isArrayExpression(value)
        ))
  );

export const isValidWorkspaceConfigFile: (fileContents: string, babel: any) => boolean = (
  fileContents
) => {
  let isValidWorkspaceConfig = false;
  const parsedFile = babel.babelParse(fileContents);
  babel.traverse(parsedFile, {
    ExportDefaultDeclaration(path: any) {
      isValidWorkspaceConfig =
        isWorkspaceConfigArray(path.node.declaration) ||
        isDefineWorkspaceExpression(path.node.declaration);
    },
  });
  return isValidWorkspaceConfig;
};

/**
 * Check if existing Vite/Vitest workspace/config file can be safely modified, if not prompt:
 *
 * - Yes -> ignore test intent
 * - No -> exit
 */
const name = 'Vitest configuration';
export const vitestConfigFiles: Check = {
  condition: async (context, state) => {
    const deps = ['babel', 'findUp', 'fs'];
    if (babel && findUp && fs) {
      const reasons = [];

      const vitestWorkspaceFile = await findUp(
        ['ts', 'js', 'json'].flatMap((ex) => [`vitest.workspace.${ex}`, `vitest.projects.${ex}`]),
        { cwd: state.directory }
      );
      if (vitestWorkspaceFile?.endsWith('.json')) {
        reasons.push(`Cannot auto-update JSON workspace file: ${vitestWorkspaceFile}`);
      } else if (vitestWorkspaceFile) {
        const fileContents = await fs.readFile(vitestWorkspaceFile, 'utf8');
        if (!isValidWorkspaceConfigFile(fileContents, babel)) {
          reasons.push(`Found an invalid workspace config file: ${vitestWorkspaceFile}`);
        }
      }

      const vitestConfigFile = await findUp(
        ['ts', 'js', 'tsx', 'jsx', 'cts', 'cjs', 'mts', 'mjs'].map((ex) => `vitest.config.${ex}`),
        { cwd: state.directory }
      );
      if (vitestConfigFile?.endsWith('.cts') || vitestConfigFile?.endsWith('.cjs')) {
        reasons.push(`Cannot auto-update CommonJS config file: ${vitestConfigFile}`);
      } else if (vitestConfigFile) {
        let isValidVitestConfig = false;
        const configContent = await fs.readFile(vitestConfigFile, 'utf8');
        const parsedConfig = babel.babelParse(configContent);
        babel.traverse(parsedConfig, {
          ExportDefaultDeclaration(path) {
            if (
              isDefineConfigExpression(path.node.declaration) &&
              isSafeToExtendWorkspace(path.node.declaration as CallExpression)
            ) {
              isValidVitestConfig = true;
            }
          },
        });
        if (!isValidVitestConfig) {
          reasons.push(`Found an invalid Vitest config file: ${vitestConfigFile}`);
        }
      }

      return reasons.length
        ? { type: CompatibilityType.INCOMPATIBLE, reasons }
        : { type: CompatibilityType.COMPATIBLE };
    }
    return {
      type: CompatibilityType.INCOMPATIBLE,
      reasons: deps
        .filter((p) => !context[p as keyof typeof context])
        .map((p) => `Missing ${p} on context`),
    };
  },
};
