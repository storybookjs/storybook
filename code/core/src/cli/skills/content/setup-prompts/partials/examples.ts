import { dedent } from 'ts-dedent';
import type { ProjectInfo } from '../../../project-info.ts';
import { ext } from '../../setup-utils/ext.ts';
import { isReactProject } from '../../setup-utils/is-react-project.ts';
import { getTypeImportSource } from '../../setup-utils/type-import-source.ts';

export function getPreviewExample(projectInfo: ProjectInfo): string {
  if (projectInfo.aiInstructions?.preview !== undefined) {
    return projectInfo.aiInstructions.preview;
  }
  const { configDir, language, hasCsfFactoryPreview } = projectInfo;
  const tsx = language;
  const typeImport = getTypeImportSource(projectInfo);

  if (hasCsfFactoryPreview) {
    return dedent`
      \`\`\`${tsx}
      // ${configDir}/preview.${tsx}
      import { definePreview } from '${typeImport}';
      import '../src/index.css';
      import MockDate from 'mockdate';
      import addonMsw from 'msw-storybook-addon';
      import { mswHandlers } from './msw-handlers';

      export default definePreview({
        addons: [addonMsw()],
        async beforeEach({ msw }) {
          msw.use(...mswHandlers);
          localStorage.setItem('theme', 'dark');
          MockDate.set('2024-04-01T12:00:00Z');
        },
      });
      \`\`\`
    `;
  }

  if (language === 'js') {
    return dedent`
      \`\`\`${tsx}
      // ${configDir}/preview.${tsx}
      import '../src/index.css';
      import MockDate from 'mockdate';
      import { mswLoader } from 'msw-storybook-addon/csf3';
      import { mswHandlers } from './msw-handlers';

      const preview = {
        loaders: [mswLoader()],
        async beforeEach({ msw }) {
          msw.use(...mswHandlers);
          localStorage.setItem('theme', 'dark');
          MockDate.set('2024-04-01T12:00:00Z');
        },
      };

      export default preview;
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${tsx}
    // ${configDir}/preview.${tsx}
    import type { Preview } from '${typeImport}';
    import '../src/index.css';
    import MockDate from 'mockdate';
    import { mswLoader } from 'msw-storybook-addon/csf3';
    import { mswHandlers } from './msw-handlers';

    const preview: Preview = {
      loaders: [mswLoader()],
      async beforeEach({ msw }) {
        msw.use(...mswHandlers);
        localStorage.setItem('theme', 'dark');
        MockDate.set('2024-04-01T12:00:00Z');
      },
    };

    export default preview;
    \`\`\`
  `;
}

export function getPortalDecoratorExample(projectInfo: ProjectInfo): string {
  const { language } = projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));

  return dedent`
    \`\`\`${tsx}
    // Add this entry to the \`decorators\` array of your preview config:
    (Story) => {
      for (const id of ['modal-root', 'drawer-root', 'toast-root']) {
        if (!document.getElementById(id)) {
          const el = document.createElement('div');
          el.id = id;
          document.body.appendChild(el);
        }
      }
      return ${isReactProject(projectInfo) ? '<Story />' : 'Story()'};
    }
    \`\`\`
  `;
}

export function getMainConfigExample(projectInfo: ProjectInfo): string {
  const { configDir, language } = projectInfo;
  const ts = ext(language, false);
  const typeImport = getTypeImportSource(projectInfo);

  if (language === 'js') {
    return dedent`
      \`\`\`js
      // ${configDir}/main.js
      const config = { staticDirs: ['../public'] };
      export default config;
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${ts}
    // ${configDir}/main.${ts}
    import type { StorybookConfig } from '${typeImport}';

    const config: StorybookConfig = { staticDirs: ['../public'] };
    export default config;
    \`\`\`
  `;
}

export function getStoryExample(projectInfo: ProjectInfo): string {
  return (
    projectInfo.aiInstructions?.story ??
    dedent`
    Follow existing stories and the installed framework's Component Story Format. Import the real component using the project's conventions and use its actual props or inputs as \`args\`. Use the framework's rendering syntax for composition, projected content, slots, and event bindings when needed.

    For TypeScript, import \`Meta\` and \`StoryObj\` from '${getTypeImportSource(projectInfo)}' and use the type parameters supported by that framework. Add \`tags: ['ai-generated', 'needs-work']\` to the meta, then export story objects for the component's meaningful states. Include a \`play\` function only when it verifies behavior.
  `
  );
}

export function getInteractionPlayExample(projectInfo: ProjectInfo): string {
  const { language } = projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));
  const typeAnnotation = language === 'ts' ? ': Story' : '';

  return dedent`
    \`\`\`${tsx}
    export const FilledForm${typeAnnotation} = {
      play: async ({ canvas, userEvent }) => {
        await userEvent.type(canvas.getByLabelText('email'), 'a@b.com', { delay: 50 });
        await userEvent.click(canvas.getByRole('button', { name: /submit/i }));
        await expect(await canvas.findByText(/welcome/i)).toBeVisible();
      },
    };
    \`\`\`
  `;
}
