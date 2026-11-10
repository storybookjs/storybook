import { findStoriesSection, type FindStoriesInputs } from './find-stories.ts';
import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type UiReviewSkillInputs = FindStoriesInputs & {
  // `mcp` for `skills ui-review --mcp`: tools of the Storybook MCP server instead of commands.
  transport: SkillTextTransport;
  // The `dev` toolset is on: the review, story links and `stories-changed`. Always for the CLI.
  devEnabled: boolean;
};

const REVIEW_EXAMPLE = `{
  "title": "Rounder buttons",
  "description": "The **Button** corner radius goes from 4px to 8px.",
  "collections": [
    { "title": "Button variants", "rationale": "The component that changed.", "storyIds": ["button--primary", "button--disabled"] },
    { "title": "Forms that use it", "rationale": "Where the change shows up in context.", "storyIds": ["login-form--default"] }
  ],
  "changedFiles": ["src/Button.tsx"]
}`;

export function buildUiReviewSkill(inputs: UiReviewSkillInputs): string {
  const v = skillVocabulary(inputs.transport);
  if (!inputs.devEnabled) {
    return `# Storybook UI review

The Storybook MCP server of this project cannot publish a review: its \`dev\` toolset is off. Skip this step.`;
  }
  const discoverFirst = inputs.moduleGraphSupported
    ? ` When you changed files, take the story ids from ${v.name('stories.changed')}, ${v.cli ? 'run' : 'called'} after your last edit (and from ${v.name('stories.findByComponent')} only for a file it leaves out), also when you only wrote stories; never take them from the test ${v.output}.`
    : '';
  const review = v.cli
    ? `\`\`\`sh
${v.ref('review.create')} --input '${REVIEW_EXAMPLE}'
\`\`\``
    : `Call ${v.name('review.create')} with:

\`\`\`json
${REVIEW_EXAMPLE}
\`\`\``;
  const preview = v.cli
    ? `\`\`\`sh
${v.ref('stories.preview')} --stories '[{"storyId":"<id>"}]'   # direct links to stories
\`\`\``
    : `- ${v.name('stories.preview')} with \`stories: [{ "storyId": "<id>" }]\`: direct links to stories`;
  return `# Storybook UI review

${v.notes}

${findStoriesSection(v, inputs, { forReview: true })}

## Publish the review

${review}

Publish a review after every change the user can see, and again after each later change.${v.cli ? ' It needs a running Storybook.' : ''}${discoverFirst} Group the stories into two to five collections, from the changed component up to the pages that show it (one is enough when a single component is affected), and include every story you created. List every file you created or changed in \`changedFiles\`, story files too. When the user only asks to see or browse components or stories and you changed no files, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed, such as a change to a callback, tests or types, and the user did not ask to see anything, and say that instead.

Publish it as your last step, after your other checks such as the story tests, a type check, lint or \`git status\`. Then end your answer with the three lines ${v.cli ? 'the command prints' : 'its result gives you'}, unchanged: heading, text line and 👉 link, with nothing after them. Do not list separate story links next to them or repeat the review link elsewhere in your answer.

## Link to one story

${preview}

Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless ${v.name('review.create')} keeps failing after you fixed what it reported: then share these links and say why.`;
}
