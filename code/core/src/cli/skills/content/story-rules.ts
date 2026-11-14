// The story-writing rules of the `write-stories` skill.

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

// Adding a dependency is the team's decision, not a skill's: agents that were told to set up MSW
// installed it for a one-line change. Without MSW, the stories that need the network wait.
export function networkMockRule({ previewFile }: StoryFormatInputs): string {
  return `A story never calls a real service, and never fakes one with a module mock or a replaced \`fetch\`: leave the code that calls \`fetch\` as it is. Every story of a component that fetches needs a network mock. When the project has MSW set up for Storybook (\`msw-storybook-addon\` installed, in a monorepo also at the root, and loaded by \`${previewFile}\` directly or through a file it imports), mock the requests with it: give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`. Read the version of \`msw-storybook-addon\` in the project's \`package.json\`: only before version 3 do stories have no \`msw\` in \`beforeEach\` and take \`parameters: { msw: { handlers: [...] } }\` instead. From version 3 on, never write \`parameters.msw\`. When the project has no MSW setup, do not add one or any other dependency: write the stories that need no network, and in your answer tell the user which stories, such as one for the page, would need a network mock, and that MSW would give them. Do not stop to ask.`;
}
