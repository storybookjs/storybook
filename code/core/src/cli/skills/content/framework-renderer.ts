import { frameworkRegistry, rendererRegistry } from '../../../common/utils/framework.ts';

/** Maps each framework package to the package of the renderer it uses */
export const frameworkToRendererMap: Record<string, string> = Object.fromEntries(
  Object.values(frameworkRegistry).flatMap(({ packageName, renderer }) => {
    const rendererPackage = rendererRegistry[renderer].packageName;
    return rendererPackage ? [[packageName, rendererPackage]] : [];
  })
);
