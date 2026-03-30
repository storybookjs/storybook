export function createDynamicStylesPlay(cssRule: string) {
  return async ({ id: storyId }: { id: string }) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // @ts-expect-error We're adding this nonstandard property
        if (globalThis[`__dynamicRuleInjected_${storyId}`]) {
          return;
        }
        // @ts-expect-error We're adding this nonstandard property
        globalThis[`__dynamicRuleInjected_${storyId}`] = true;
        const sheet = Array.from(document.styleSheets).at(-1);
        sheet?.insertRule(cssRule);
        resolve();
      }, 100);
    });
  };
}
