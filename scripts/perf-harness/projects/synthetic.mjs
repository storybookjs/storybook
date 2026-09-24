// Generated React + Vite Storybook. One npm install per build; the stories are regenerated when the
// requested shape changes.
//
// Shapes (entries = stories in index.json; every component file has STORIES_PER_COMPONENT stories):
// - balanced: roots of 20 components each (`Root007/Comp00123`).
// - wide:     one root holding every component (`Root/Comp00123`).
// - docgen:   the SB-2057 docgen project: `size` React components with typed props, two stories and
//             an autodocs page each, addon-docs, and `features.experimentalDocgenServer`.
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { log, run, sh } from '../lib/util.mjs';
import { componentsFromIndex, spreadFirstStories, spreadTargets } from './shared.mjs';

const STORIES_PER_COMPONENT = 5;
const COMPONENTS_PER_ROOT = 20;
const DOCGEN_GROUP_SIZE = 50;

export const monorepoPackages = [
  'storybook',
  '@storybook/react-vite',
  '@storybook/react',
  '@storybook/builder-vite',
  '@storybook/react-dom-shim',
  '@storybook/addon-docs',
];
const directPackages = ['storybook', '@storybook/react-vite', '@storybook/addon-docs'];

export async function ensureProject({ build, workDir, size, shape }) {
  const dir = join(workDir, 'projects', `synthetic-${build.key}`);
  const installMarker = join(dir, 'node_modules/.perf-harness-build');
  if (!existsSync(installMarker) || (await readFile(installMarker, 'utf8')) !== build.key) {
    await mkdir(dir, { recursive: true });
    const specs = Object.fromEntries(monorepoPackages.map((name) => [name, build.spec(name)]));
    const packageJson = {
      name: `perf-harness-synthetic`,
      private: true,
      type: 'module',
      dependencies: { react: '^19.1.0', 'react-dom': '^19.1.0' },
      devDependencies: {
        ...Object.fromEntries(directPackages.map((name) => [name, specs[name]])),
        '@types/react': '^19.1.0',
        '@types/react-dom': '^19.1.0',
        typescript: '~5.9.2',
        vite: '^7.1.0',
      },
      overrides: specs,
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
    await rm(join(dir, 'package-lock.json'), { force: true });
    await rm(join(dir, 'node_modules'), { recursive: true, force: true });
    log(`npm install in ${dir} (${build.label})`);
    await run(
      'npm',
      ['install', '--no-audit', '--no-fund', '--legacy-peer-deps', '--loglevel=error'],
      { cwd: dir }
    );
    await writeFile(installMarker, build.key);
  }

  const shapeKey = `${shape}-${size}-v2`;
  const shapeMarker = join(dir, '.perf-harness-shape');
  if (!existsSync(shapeMarker) || (await readFile(shapeMarker, 'utf8')) !== shapeKey) {
    log(
      `generating ${shape} project with ${size} ${shape === 'docgen' ? 'components' : 'stories'} in ${dir}`
    );
    await generate(dir, size, shape);
    await writeFile(shapeMarker, shapeKey);
    // A clean git baseline, so change detection starts with no changed files.
    await writeFile(
      join(dir, '.gitignore'),
      'node_modules\n.perf-harness-shape\nstorybook-static\n'
    );
    if (!existsSync(join(dir, '.git'))) {
      sh('git', ['init', '-q'], { cwd: dir });
    }
    sh('git', ['add', '-A'], { cwd: dir });
    sh(
      'git',
      [
        '-c',
        'user.name=perf-harness',
        '-c',
        'user.email=perf-harness@localhost',
        'commit',
        '-q',
        '--no-verify',
        '--allow-empty',
        '-m',
        `shape ${shapeKey}`,
      ],
      { cwd: dir }
    );
  }
  return dir;
}

const pad = (n, width = 5) => String(n).padStart(width, '0');

async function generate(dir, size, shape) {
  await rm(join(dir, 'src'), { recursive: true, force: true });
  await mkdir(join(dir, '.storybook'), { recursive: true });
  const docgen = shape === 'docgen';
  await writeFile(
    join(dir, '.storybook/main.ts'),
    [
      `import type { StorybookConfig } from '@storybook/react-vite';`,
      '',
      'const config: StorybookConfig = {',
      `  stories: ['../src/**/*.stories.tsx'],`,
      `  addons: [${docgen ? `'@storybook/addon-docs'` : ''}],`,
      `  framework: '@storybook/react-vite',`,
      docgen ? '  features: { experimentalDocgenServer: true },' : null,
      '  core: { disableTelemetry: true, disableWhatsNewNotifications: true },',
      '};',
      'export default config;',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n')
  );
  await writeFile(
    join(dir, '.storybook/preview.ts'),
    [
      `import type { Preview } from '@storybook/react-vite';`,
      '',
      `const preview: Preview = ${docgen ? `{ tags: ['autodocs'] }` : '{}'};`,
      'export default preview;',
      '',
    ].join('\n')
  );
  await writeFile(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          lib: ['DOM', 'ES2022'],
        },
        include: ['src', '.storybook'],
      },
      null,
      2
    ) + '\n'
  );

  if (docgen) {
    for (let i = 0; i < size; i += 1) {
      const group = `Group${pad(Math.floor(i / DOCGEN_GROUP_SIZE), 4)}`;
      const folder = join(dir, 'src', group);
      await mkdir(folder, { recursive: true });
      const name = `Widget${pad(i, 4)}`;
      await writeFile(join(folder, `${name}.tsx`), docgenComponentSource(name, i));
      await writeFile(join(folder, `${name}.stories.tsx`), docgenStorySource(name, group));
    }
    return;
  }

  const components = Math.ceil(size / STORIES_PER_COMPONENT);
  for (let c = 0; c < components; c += 1) {
    const root = shape === 'wide' ? 'Root' : `Root${pad(Math.floor(c / COMPONENTS_PER_ROOT), 3)}`;
    const folder = join(dir, 'src', root);
    await mkdir(folder, { recursive: true });
    const name = `Comp${pad(c)}`;
    const stories = Math.min(STORIES_PER_COMPONENT, size - c * STORIES_PER_COMPONENT);
    await writeFile(join(folder, `${name}.stories.tsx`), floodStorySource(root, name, stories));
  }
}

function floodStorySource(root, name, stories) {
  const lines = [
    `import * as React from 'react';`,
    `import type { Meta, StoryObj } from '@storybook/react-vite';`,
    '',
    `const ${name} = ({ label }: { label: string }) => React.createElement('div', null, label);`,
    '',
    `const meta = { title: '${root}/${name}', component: ${name} } satisfies Meta<typeof ${name}>;`,
    'export default meta;',
    '',
    'type Story = StoryObj<typeof meta>;',
    '',
  ];
  for (let s = 0; s < stories; s += 1) {
    lines.push(`export const Story${s}: Story = { args: { label: '${name} ${s}' } };`);
  }
  return lines.join('\n') + '\n';
}

// Every fifth component extends the DOM attributes of its root element, like most design-system
// components do, which makes its docgen payload an order of magnitude larger.
function docgenComponentSource(name, i) {
  const heritage = i % 5 === 0 ? ` extends React.HTMLAttributes<HTMLDivElement>` : '';
  return [
    `import * as React from 'react';`,
    '',
    `export type ${name}Item = { id: string; title: string; done?: boolean; tags?: string[] };`,
    '',
    `export interface ${name}Props${heritage} {`,
    `  /** Text shown in the header of ${name}. */`,
    '  label: string;',
    '  /**',
    '   * Visual variant.',
    `   * @default 'primary'`,
    '   */',
    `  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';`,
    '  /** Size of the control. */',
    `  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';`,
    '  /** Disables every interaction. */',
    '  disabled?: boolean;',
    '  /** Number of items to render before "show more". */',
    '  limit?: number;',
    '  /** Items rendered as a list. */',
    `  items?: ${name}Item[];`,
    '  /** Fires when the user edits the value. */',
    '  onValueChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;',
    '  /** Fires when an item is selected. */',
    `  onItemSelect?: (id: string, item: ${name}Item) => void;`,
    '  /** Custom item renderer. */',
    `  renderItem?: (item: ${name}Item, index: number) => React.ReactNode;`,
    '  /** Inline style overrides for the root element. */',
    '  rootStyle?: React.CSSProperties;',
    '  /** Placement of the popover. */',
    `  placement?: 'top' | 'right' | 'bottom' | 'left' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';`,
    '  /** Accessible description, read by screen readers. */',
    '  ariaDescription?: string;',
    '  /** Bench marker. The benchmark rewrites this union on every simulated save. */',
    `  benchRevision?: 'rev_initial';`,
    '}',
    '',
    `/** ${name} renders a labelled list with a variant and a size. */`,
    `export const ${name} = ({ label, variant = 'primary', size = 'md', items = [], limit = 5 }: ${name}Props) => (`,
    '  <div data-variant={variant} data-size={size}>',
    '    <strong>{label}</strong>',
    '    <ul>',
    '      {items.slice(0, limit).map((item) => (',
    '        <li key={item.id}>{item.title}</li>',
    '      ))}',
    '    </ul>',
    '  </div>',
    ');',
    '',
  ].join('\n');
}

function docgenStorySource(name, group) {
  return [
    `import type { Meta, StoryObj } from '@storybook/react-vite';`,
    '',
    `import { ${name} } from './${name}';`,
    '',
    `const meta = { title: '${group}/${name}', component: ${name} } satisfies Meta<typeof ${name}>;`,
    'export default meta;',
    '',
    'type Story = StoryObj<typeof meta>;',
    '',
    `export const Primary: Story = { args: { label: '${name}', items: [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }] } };`,
    '',
    `export const Danger: Story = { args: { label: '${name} danger', variant: 'danger' } };`,
    '',
  ].join('\n');
}

// Adapter used by run.mjs.
export async function createProject(dir, { shape }) {
  const project = {
    dir,
    nodeArgs: [],
    searchQuery: shape === 'docgen' ? 'widget01' : 'comp001',
    prepare(index) {
      const entries = Object.values(index.entries);
      const stories = entries.filter((e) => e.type === 'story');
      project.index = index;
      project.firstStoryId = stories[0].id;
      project.storyIdsAll = stories.map((e) => e.id);
      project.components = componentsFromIndex(index).map((c) => ({
        ...c,
        file: join(
          dir,
          shape === 'docgen' ? c.importPath.replace('.stories.tsx', '.tsx') : c.importPath
        ),
        apply:
          shape === 'docgen'
            ? (source, marker) =>
                source.replace("benchRevision?: 'rev_initial';", `benchRevision?: '${marker}';`)
            : (source, marker) => `${source}// ${marker}\n`,
      }));
      project.componentCount = project.components.length;
      project.lastComponentId = project.components.at(-1).componentId;
    },
    editTargets: (sizes) => spreadTargets(project.components, sizes),
    docsEntryIds: (n) =>
      Object.values(project.index.entries)
        .filter((e) => e.type === 'docs')
        .map((e) => e.id)
        .filter((_, i, all) => i % Math.max(1, Math.floor(all.length / n)) === 0)
        .slice(0, n),
    visitIds: (n) => spreadFirstStories(project.index, n),
    storyIds: (n) => project.storyIdsAll.slice(0, n),
  };
  return project;
}
