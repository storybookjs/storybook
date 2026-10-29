export type ArchKind = 'core' | 'ui' | 'manager' | 'product' | 'feature' | 'openService' | 'addon'

export interface ArchHue {
  /** Legend label, named after the package that owns the pieces. */
  label: string
  /** CSS color, from the theme tokens where one exists. */
  color: string
}

export const ARCH_PALETTE: Record<ArchKind, ArchHue> = {
  product: { label: 'storybook', color: 'var(--sb-pink)' },
  manager: { label: '@storybook/manager', color: 'var(--sb-gold)' },
  ui: { label: '@storybook/ui', color: 'var(--sb-teal)' },
  core: { label: '@storybook/core', color: 'var(--sb-blue-500)' },
  openService: { label: '@storybook/open-service', color: '#8B5CF6' },
  feature: { label: 'Built-in feature addons', color: 'var(--sb-green)' },
  addon: { label: 'Official addons and plugins', color: '#F97316' },
}
