import { escapeRegExp } from 'es-toolkit/string';

import { getToolName } from '../../shared/open-service/toolset-names.ts';
import { renderMethodHelpFromCatalog } from '../tools/help.ts';
import type { ToolsetCatalogEntry, ToolsetCatalogMethod } from '../tools/sdk/types.ts';

const toCommand = getToolName({ transport: 'cli' });

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
  // Entries name further commands (`docs show` names `docs show-story`). Follow them only within
  // toolsets the text names: `review create` names `docs list` even when docs are off.
  let referred = findReferredTools(skillText, toolsets);
  const namedToolsets = toolsets.filter((toolset) =>
    toolset.methods.some((method) => referred.includes(method))
  );
  for (;;) {
    const text = [skillText, ...referred.map(renderMethodHelpFromCatalog)].join('\n');
    const found = findReferredTools(text, namedToolsets);
    if (found.length === referred.length) {
      break;
    }
    referred = found;
  }
  if (referred.length === 0) {
    return '';
  }
  return [
    '# Command reference',
    "`--json` only changes the output format; to pass all arguments as one JSON object, use `--input '<json>'`.",
    ...referred.map((method) =>
      [`${FENCE}text`, renderMethodHelpFromCatalog(method), FENCE].join('\n')
    ),
  ].join('\n\n');
}
