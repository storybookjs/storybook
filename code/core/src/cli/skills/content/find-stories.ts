import type { SkillVocabulary } from './skill-vocabulary.ts';

export type FindStoriesInputs = {
  docsEnabled: boolean;
  moduleGraphSupported: boolean;
};

// How to get story ids, for the skills that take them: `test-stories` and `ui-review`. Only a
// review has to cover every story a change affects, so only `ui-review` gets those rules.
export function findStoriesSection(
  v: SkillVocabulary,
  { docsEnabled, moduleGraphSupported }: FindStoriesInputs,
  { forReview }: { forReview: boolean }
): string {
  const changed = v.name('stories.changed');
  const findByComponent = v.name('stories.findByComponent');
  const commands = v.cli
    ? [
        moduleGraphSupported &&
          `${v.ref('stories.changed')}   # stories affected by your uncommitted changes`,
        moduleGraphSupported &&
          `${v.ref('stories.findByComponent')} --componentPaths '["/abs/path/Button.tsx"]'   # only for files stories changed leaves out`,
        docsEnabled && `${v.ref('docs.list')} --withStoryIds true   # every story id`,
      ].filter(Boolean)
    : [
        moduleGraphSupported && `- ${changed}: stories affected by your uncommitted changes`,
        moduleGraphSupported &&
          `- ${findByComponent} with \`componentPaths: ["/abs/path/Button.tsx"]\`: only for files ${changed} leaves out`,
        docsEnabled && `- ${v.name('docs.list')} with \`withStoryIds: true\`: every story id`,
      ].filter(Boolean);
  if (commands.length === 0) {
    const select = v.cli
      ? `\`--stories '[{"absoluteStoryPath":"/abs/path/Button.stories.tsx","exportName":"Primary"}]'\``
      : '`stories: [{ "absoluteStoryPath": "/abs/path/Button.stories.tsx", "exportName": "Primary" }]`';
    const none = v.cli
      ? 'This project has no command that lists story ids.'
      : 'This Storybook has no tool that lists story ids.';
    // A review takes story ids only, and a story link ends with the id of its story.
    const use = forReview
      ? `Get the link of each story from ${v.name('stories.preview')}, which selects a story by its file and export: ${select}. The id follows \`/story/\` in the link.`
      : `Select a story by its file and export instead: ${select}.`;
    return `## Find the stories

${none} ${use}`;
  }
  const several = commands.length > 1;
  const guidance = [
    forReview &&
      moduleGraphSupported &&
      `${v.Run} ${changed} after your last edit and before every review, also when you already know the ids of the stories you wrote: it adds the stories of other components that your change affects.${v.cli ? ' Run it in a command of its own and read its whole output, without `head` or `tail`.' : ''} The list covers your edits so far, so checks in between, such as a type check, need no new call.`,
    `Story ids come only from the ${v.output} of ${several ? `these ${v.commands}` : `this ${v.command}`}, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory.`,
    forReview &&
      moduleGraphSupported &&
      `When ${changed} leaves out a file you touched, pass that file to ${findByComponent}, or for a shared file (design token, theme, util, hook), which has no stories of its own, the components that use it. When ${findByComponent} reports stories hidden by \`maxDistance\`, ${v.cli ? 'rerun it' : 'call it again'} with a higher ${v.flag('maxDistance')}.`,
    `When ${several ? 'none of them finds' : 'it does not find'} a story for a component, it has no stories yet: say so, or write them.`,
  ]
    .filter(Boolean)
    .join(' ');
  const list = v.cli
    ? `\`\`\`sh
${commands.join('\n')}
\`\`\``
    : commands.join('\n');
  return `## Find the stories

${list}

${guidance}`;
}
