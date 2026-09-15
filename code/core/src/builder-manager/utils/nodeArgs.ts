function splitLongFlag(arg: string): string[] {
  const match = arg.match(/^(--[^=]+)=(.*)$/);
  return match ? [match[1], match[2]] : [arg];
}

export function getNodeExecArgs(
  execArgv: string[] = process.execArgv,
  nodeOptions: string | undefined = process.env.NODE_OPTIONS
): string[] {
  const nodeOptionsTokens = nodeOptions?.split(/\s+/).filter(Boolean) ?? [];
  return [...execArgv, ...nodeOptionsTokens].flatMap((arg) => splitLongFlag(arg));
}
