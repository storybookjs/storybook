// The story-writing rules of the ui-workflow skill, which its CLI and MCP renderings share.

export type StoryFormatInputs = {
  // The preview file uses `definePreview`, so story files use CSF Factories.
  csfFactories: boolean;
  // Relative to the working directory.
  previewFile: string;
};

export const ERROR_EXPORT_RULE =
  "Never export a story under the name of a global such as `Error`: export `ErrorState` and set `name: 'Error'`.";

export const USER_EVENT_RULE =
  '`userEvent.click(element)` takes no options; to check a disabled element, assert `toBeDisabled()` instead of clicking it.';

export function networkMockRule({ csfFactories, previewFile }: StoryFormatInputs): string {
  const mswSetup = csfFactories
    ? "`addons: [addonMsw()]` (`import addonMsw from 'msw-storybook-addon'`, without an `initialize()` call)"
    : "`loaders: [mswLoader()]` (`import { mswLoader } from 'msw-storybook-addon/csf3'`, without an `initialize()` call)";
  return `A story never calls a real service. Mock network requests with MSW, never with a module mock or a replaced \`fetch\`: give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`, and leave the code that calls \`fetch\` as it is. When the project has no \`msw-storybook-addon\` yet, set it up first: install \`msw\` and \`msw-storybook-addon\` as dev dependencies, run \`npx msw init ./public --save\` (\`../public\` has to be in \`staticDirs\` of the main config), and add ${mswSetup} to \`${previewFile}\`. Read the version of \`msw-storybook-addon\` in the project's \`package.json\`: only before version 3 do stories have no \`msw\` in \`beforeEach\` and take \`parameters: { msw: { handlers: [...] } }\` instead. From version 3 on, never write \`parameters.msw\`.`;
}
