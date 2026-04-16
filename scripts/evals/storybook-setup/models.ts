import type { AgentName, ModelConfig, ModelTier, SupportedModel } from './types';

export const MODEL_CONFIGS: Record<SupportedModel, ModelConfig> = {
  'claude-opus-4.6': {
    id: 'claude-opus-4.6',
    agent: 'claude-code',
    cliModel: 'opus',
    tier: 'opus',
    label: 'Claude Opus 4.6',
    reasoningEffort: 'high',
  },
  'claude-sonnet-4.6': {
    id: 'claude-sonnet-4.6',
    agent: 'claude-code',
    cliModel: 'sonnet',
    tier: 'sonnet',
    label: 'Claude Sonnet 4.6',
    reasoningEffort: 'medium',
  },
  'claude-haiku-4.5': {
    id: 'claude-haiku-4.5',
    agent: 'claude-code',
    cliModel: 'haiku',
    tier: 'haiku',
    label: 'Claude Haiku 4.5',
    reasoningEffort: 'medium',
  },
  'gpt-5.4': {
    id: 'gpt-5.4',
    agent: 'codex-cli',
    cliModel: 'gpt-5.4',
    tier: 'opus',
    label: 'GPT-5.4',
    reasoningEffort: 'high',
    notes: 'Default highest-capability Codex tier.',
  },
  'gpt-5-codex': {
    id: 'gpt-5-codex',
    agent: 'codex-cli',
    cliModel: 'gpt-5-codex',
    tier: 'sonnet',
    label: 'GPT-5 Codex',
    reasoningEffort: 'medium',
    notes: 'Balanced Codex coding model.',
  },
  'gpt-5-codex-mini': {
    id: 'gpt-5-codex-mini',
    agent: 'codex-cli',
    cliModel: 'gpt-5-codex-mini',
    tier: 'haiku',
    label: 'GPT-5 Codex Mini',
    reasoningEffort: 'medium',
    notes: 'Fastest low-cost Codex tier.',
  },
  'gpt-5.4-mini': {
    id: 'gpt-5.4-mini',
    agent: 'codex-cli',
    cliModel: 'gpt-5.4-mini',
    tier: 'sonnet',
    label: 'GPT-5.4 Mini',
    reasoningEffort: 'medium',
    notes: 'Supported as an explicit override; not the default tier mapping.',
  },
  'gpt-5.2-codex': {
    id: 'gpt-5.2-codex',
    agent: 'codex-cli',
    cliModel: 'gpt-5.2-codex',
    tier: 'sonnet',
    label: 'GPT-5.2 Codex',
    reasoningEffort: 'high',
    notes: 'Legacy Codex model retained for comparison runs.',
  },
};

export const DEFAULT_MODEL_BY_TIER: Record<AgentName, Record<ModelTier, SupportedModel>> = {
  'claude-code': {
    opus: 'claude-opus-4.6',
    sonnet: 'claude-sonnet-4.6',
    haiku: 'claude-haiku-4.5',
  },
  'codex-cli': {
    opus: 'gpt-5.4',
    sonnet: 'gpt-5-codex',
    haiku: 'gpt-5-codex-mini',
  },
};

export const ALL_MODELS = Object.values(MODEL_CONFIGS);

export const ALL_TIERS: ModelTier[] = ['opus', 'sonnet', 'haiku'];

export function resolveModel(agent: AgentName, tier?: ModelTier, explicitModel?: SupportedModel) {
  if (explicitModel) {
    const config = MODEL_CONFIGS[explicitModel];
    if (config.agent !== agent) {
      throw new Error(`Model "${explicitModel}" is not supported by ${agent}.`);
    }

    return config;
  }

  const resolvedTier = tier ?? 'sonnet';
  return MODEL_CONFIGS[DEFAULT_MODEL_BY_TIER[agent][resolvedTier]];
}
