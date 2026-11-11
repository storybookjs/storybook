import { dedent } from 'ts-dedent';

export function listRules(rules: (string | undefined)[]): string {
  return dedent`
    ${rules
      .filter(Boolean)
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')}
  `;
}

export function listSteps(
  steps: { title: string; body: string }[],
  options?: { level?: number }
): string {
  const level = options?.level ?? 2;
  const prefix = '#'.repeat(level);
  return dedent`
    ${steps
      .filter(Boolean)
      .map((step, i) => `${prefix} Step ${i + 1} — ${step.title}\n\n${step.body}`)
      .join('\n\n')}
  `;
}

export function listDOD(dods: (string | undefined)[]): string {
  return dedent`
    ${dods
      .filter(Boolean)
      .map((s) => `- ${s}`)
      .join('\n')}
  `;
}
