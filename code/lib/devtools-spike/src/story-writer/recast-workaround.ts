// Copied from the private `removeExtraNewlines` in
// code/core/src/core-server/utils/save-story/save-story.ts (not exported from csf-tools).
// Works around recast#242, which prints extra newlines between story properties
// after AST mutations.
const removeExtraNewlines = (code: string, name: string) => {
  const anything = '([\\s\\S])'; // Multiline match for any character.
  const newline = '(\\r\\n|\\r|\\n)'; // Either newlines or carriage returns may be used in the file.
  const closing = newline + '};' + newline; // Marks the end of the story definition.
  const regex = new RegExp(
    // Looks for an export by the given name, considers the first closing brace on its own line
    // to be the end of the story definition.
    `^(?<before>${anything}*)(?<story>export const ${name} =${anything}+?${closing})(?<after>${anything}*)$`
  );
  const { before, story, after } = code.match(regex)?.groups || {};
  return story
    ? before + story.replaceAll(/(\r\n|\r|\n)(\r\n|\r|\n)([ \t]*[a-z0-9_]+): /gi, '$2$3:') + after
    : code;
};

export { removeExtraNewlines };
