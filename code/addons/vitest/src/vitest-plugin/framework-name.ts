export const isReactFramework = (frameworkName: string | undefined) =>
  /(?:^|[\/-])(?:react|nextjs)(?:-|$)/.test(frameworkName ?? '');
