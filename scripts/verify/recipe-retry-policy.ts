// Declarative retry policy for the recipe-author skill.
// The bun orchestrator does NOT branch on retry logic; this config is
// imported by the verify-recipe-author skill (Lane C) so the policy can
// evolve without touching the generator.

export const RECIPE_RETRY_POLICY = {
  maxAttempts: 2,
  errorCategories: ['listener-before-goto', 'attach-pattern', 'imports'],
} as const;
