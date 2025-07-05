import { createContext } from 'react';

export const AppContext = createContext({
  packageManager: undefined as
    | import('../../../../../core/src/common/js-package-manager/JsPackageManager').JsPackageManager
    | undefined,
});
