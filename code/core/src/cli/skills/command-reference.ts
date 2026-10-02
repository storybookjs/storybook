import { escapeRegExp } from 'es-toolkit/string';

import { getToolName } from '../../shared/open-service/toolset-names.ts';
import { renderMethodHelpFromCatalog } from '../tools/help.ts';
import type { ToolsetCatalogEntry, ToolsetCatalogMethod } from '../tools/sdk/types.ts';
import { getSkillRef } from './content/skill-refs.ts';
import type { SkillId } from './content/skills.ts';

const toCommand = getToolName({ transport: 'cli' });

const INTRO = [
  'The `npx storybook tools` commands named above, each exactly as its `--help` prints it, so there is no need to run `--help` first.',
  "Pass arguments as `--key value` flags, with array and object values as JSON (`--key '[...]'`), or all of them at once with `--input '<json object>'`.",
  'Add `--json` to print the data listed under Output instead of markdown.',
].join(' ');

// Four backticks, so a description that carries its own three-backtick fence stays inside the block.
const FENCE = '````';

export function findReferredTools(
  skillText: string,
  toolsets: ToolsetCatalogEntry[]
): ToolsetCatalogMethod[] {
  return toolsets.flatMap((toolset) =>
    toolset.methods.filter((method) =>
      // The lookahead keeps `docs show-story` from counting as a mention of `docs show`.
      new RegExp(`${escapeRegExp(toCommand(method.ref))}(?![\\w-])`).test(skillText)
    )
  );
}

// A tool that `describedIn` also names is left to that skill's reference and replaced by a pointer
// to it, so a session that reads both skills gets each tool once.
export function renderCommandReference(
  skillText: string,
  toolsets: ToolsetCatalogEntry[],
  describedIn?: { id: SkillId; text: string }
): string {
  const referred = findReferredTools(skillText, toolsets);
  if (referred.length === 0) {
    return '';
  }
  const elsewhere = describedIn ? findReferredTools(describedIn.text, toolsets) : [];
  const described = referred.filter((method) => !elsewhere.includes(method));

  const sections = ['## Command reference'];
  if (described.length > 0) {
    sections.push(
      INTRO,
      ...described.map((method) =>
        [`${FENCE}text`, renderMethodHelpFromCatalog(method), FENCE].join('\n')
      )
    );
  }
  if (describedIn && described.length < referred.length) {
    sections.push(
      `${described.length > 0 ? 'The other commands' : 'The commands'} named above are described in the command reference at the end of \`${getSkillRef('cli')(describedIn.id)}\`.`
    );
  }
  return sections.join('\n\n');
}
