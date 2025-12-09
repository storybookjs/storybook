export const getProvideZonelessChangeDetectionFn = async () => {
  const angularCore: any = await import('@angular/core');

  return 'provideExperimentalZonelessChangeDetection' in angularCore
    ? angularCore.provideExperimentalZonelessChangeDetection
    : 'provideZonelessChangeDetection' in angularCore
      ? angularCore.provideZonelessChangeDetection
      : null;
};
