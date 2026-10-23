import { getNodeExecArgs } from './nodeArgs.ts';

export function parseConditionsFromArgs(args: string[] = getNodeExecArgs()): string[] {
  const conditions: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--conditions' || args[i] === '-C') && args[i + 1] !== undefined) {
      conditions.push(args[++i]);
    }
  }
  return Array.from(new Set(conditions));
}
