const CONDITIONS_FLAG_PATTERN = /^(?:--conditions|-C)(?:=(.+))?$/;
const ATTACHED_SHORT_FLAG_PATTERN = /^-C(.+)$/;

function collectFromTokens(tokens: string[]): string[] {
  const conditions: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const flagMatch = token.match(CONDITIONS_FLAG_PATTERN);
    if (flagMatch) {
      if (flagMatch[1]) {
        conditions.push(flagMatch[1]);
      } else if (tokens[i + 1] !== undefined) {
        conditions.push(tokens[++i]);
      }
      continue;
    }

    const attachedMatch = token.match(ATTACHED_SHORT_FLAG_PATTERN);
    if (attachedMatch) {
      conditions.push(attachedMatch[1]);
    }
  }

  return conditions;
}

/**
 * Reads the custom conditions Node was started with via `--conditions`/`-C` (either passed
 * directly or through `NODE_OPTIONS`), for merging into a resolver's own `conditions` list.
 */
export function getNodeCustomConditions(
  execArgv: string[] = process.execArgv,
  nodeOptions: string | undefined = process.env.NODE_OPTIONS
): string[] {
  const nodeOptionsTokens = nodeOptions?.split(/\s+/).filter(Boolean) ?? [];
  const conditions = [...collectFromTokens(execArgv), ...collectFromTokens(nodeOptionsTokens)];

  return Array.from(new Set(conditions));
}
