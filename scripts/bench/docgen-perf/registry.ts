/**
 * The engine table. Adding an engine means adding one entry here; the orchestrator has no
 * per-engine branches. Everything below is data: which child to spawn, with which flags, over
 * which scenarios.
 */
import type { BenchEngine } from './engine.ts';
import { CompodocEngine } from './engines/compodoc.ts';
import type { EngineId } from './types.ts';

export const ENGINES: BenchEngine[] = [new CompodocEngine()];

export const ALL_ENGINE_IDS: EngineId[] = ENGINES.map((engine) => engine.id);
export const DEFAULT_ENGINE_IDS: EngineId[] = ENGINES.filter((e) => e.inDefaultRun).map((e) => e.id);

export function engineById(id: EngineId): BenchEngine {
  const engine = ENGINES.find((candidate) => candidate.id === id);
  if (!engine) {
    throw new Error(`no engine registered for "${id}"`);
  }
  return engine;
}
