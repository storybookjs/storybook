import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { importMetaResolve } from '../../../../core/src/shared/utils/module.ts';

export type ReactDocgenConfig = 'react-docgen' | 'react-docgen-typescript' | false;

export type ReactDocgenEngine = 'react-docgen' | 'react-docgen-typescript' | 'react-component-meta';

// Why a consumer documents no props.
export type ReactDocgenOff = 'disabled' | 'react-docgen-missing';

export type DocgenEngine = ReactDocgenEngine | ReactDocgenOff;

export interface ReactDocgenPlan {
  // What the Vite plugins or webpack loaders inject as `__docgenInfo`.
  builder: { reactDocgen: 'all' | 'js' | false; reactDocgenTypescript: boolean };
  manifest: DocgenEngine | 'server';
  argTypes: Exclude<DocgenEngine, 'react-component-meta'>;
  missingReactDocgen: boolean;
}

export interface ReactDocgenPlanInput {
  docgenServer: boolean;
  experimentalReactComponentMeta: boolean;
  reactDocgen: ReactDocgenConfig;
  installed: { reactDocgen: boolean; typescript: boolean };
}

export function planReactDocgen({
  docgenServer,
  experimentalReactComponentMeta,
  reactDocgen,
  installed,
}: ReactDocgenPlanInput): ReactDocgenPlan {
  const configured =
    reactDocgen === false
      ? 'disabled'
      : reactDocgen === 'react-docgen-typescript' && installed.typescript
        ? 'react-docgen-typescript'
        : installed.reactDocgen
          ? 'react-docgen'
          : 'react-docgen-missing';
  // Ghost stories ask for argTypes with docgen server on too; react-docgen-typescript keeps
  // TypeScript projects free of react-docgen there.
  const serverArgTypes = docgenServer && installed.typescript && reactDocgen !== false;
  const builderRuns = !docgenServer && reactDocgen !== false;

  return {
    builder: {
      reactDocgen:
        builderRuns && installed.reactDocgen
          ? reactDocgen === 'react-docgen'
            ? 'all'
            : 'js'
          : false,
      reactDocgenTypescript:
        builderRuns && reactDocgen === 'react-docgen-typescript' && installed.typescript,
    },
    manifest: docgenServer
      ? 'server'
      : experimentalReactComponentMeta
        ? 'react-component-meta'
        : configured,
    argTypes: serverArgTypes ? 'react-docgen-typescript' : configured,
    missingReactDocgen: configured === 'react-docgen-missing' && !serverArgTypes,
  };
}

export const isInstalled = (pkg: 'react-docgen' | 'typescript') => {
  try {
    importMetaResolve(pkg);
    return true;
  } catch {
    return false;
  }
};

export const MISSING_REACT_DOCGEN = dedent`
  \`react-docgen\` is not installed, so Storybook does not document props or infer controls from your React components.
  Projects without TypeScript need it for prop docs (including \`propTypes\`). Install it as a devDependency: \`npm install --save-dev react-docgen\`.
  To turn prop docs off and hide this message, set \`typescript: { reactDocgen: false }\` in your main config.
  https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-react-docgen-is-an-optional-peer-dependency
`;

export async function readReactDocgenPlan(
  presets: Options['presets'],
  installed = isInstalled
): Promise<ReactDocgenPlan> {
  const [features, typescript] = await Promise.all([
    presets.apply('features', {}),
    presets.apply<{ reactDocgen?: ReactDocgenConfig }>('typescript', {}),
  ]);
  const reactDocgen = typescript?.reactDocgen ?? 'react-docgen';
  const plan = planReactDocgen({
    docgenServer: !!features?.docgenServer,
    experimentalReactComponentMeta: !!features?.experimentalReactComponentMeta,
    reactDocgen,
    installed: { reactDocgen: installed('react-docgen'), typescript: installed('typescript') },
  });

  if (plan.missingReactDocgen) {
    once.warn(MISSING_REACT_DOCGEN);
  }
  if (plan.builder.reactDocgen || plan.builder.reactDocgenTypescript) {
    once.warn(
      `Builder docgen (\`typescript.reactDocgen: '${reactDocgen}'\`) is deprecated and will be removed in Storybook 12. ` +
        `It runs because \`features.docgenServer\` is off. Server-side docgen needs the \`typescript\` package: install it and remove any \`docgenServer: false\` from your \`.storybook/main.ts\`.`
    );
  }

  return plan;
}

const plans = new WeakMap<NonNullable<Options['presetsList']>, Promise<ReactDocgenPlan>>();

// `options.presets` is a new object on every preset call, `presetsList` one per Storybook process.
export function getReactDocgenPlan({
  presets,
  presetsList,
}: Pick<Options, 'presets' | 'presetsList'>): Promise<ReactDocgenPlan> {
  if (!presetsList) {
    return readReactDocgenPlan(presets);
  }
  let plan = plans.get(presetsList);
  if (!plan) {
    plan = readReactDocgenPlan(presets);
    plans.set(presetsList, plan);
  }
  return plan;
}
