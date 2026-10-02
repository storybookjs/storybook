import { escapeRegExp } from 'es-toolkit/string';

import { getToolName } from '../../shared/open-service/toolset-names.ts';
import { renderMethodHelpFromCatalog } from '../tools/help.ts';
import type { ToolsetCatalogEntry, ToolsetCatalogMethod } from '../tools/sdk/types.ts';

const toCommand = getToolName({ transport: 'cli' });

const INTRO = [
  'The `npx storybook tools` commands named above, each exactly as its `--help` prints it, so there is no need to run `--help` first.',
  "Pass arguments as `--key value` flags, with array and object values as JSON (`--key '[...]'`), or all of them at once with `--input '<json object>'`.",
  'Add `--json` to print the data listed under Output instead of markdown.',
].join(' ');

// Four backticks, so a description that carries its own three-backtick fence stays inside the block.
const FENCE = '````';

function findReferredTools(
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

export function renderCommandReference(skillText: string, toolsets: ToolsetCatalogEntry[]): string {
  const referred = findReferredTools(skillText, toolsets);
  if (referred.length === 0) {
    return '';
  }
  return [
    '# Command reference',
    INTRO,
    ...referred.map((method) =>
      [`${FENCE}text`, renderMethodHelpFromCatalog(method), FENCE].join('\n')
    ),
  ].join('\n\n');
}
