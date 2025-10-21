import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import reactNativeGeneratorModule from '../REACT_NATIVE';
import reactNativeWebGeneratorModule from '../REACT_NATIVE_WEB';
import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT_NATIVE_AND_RNW,
    renderer: 'react',
    framework: 'react-native-web-vite',
    builderOverride: CoreBuilder.Vite,
  },
  configure: async (packageManager, context) => {
    await reactNativeGeneratorModule.configure(packageManager, context);
    const configurationResult = reactNativeWebGeneratorModule.configure(packageManager);

    return {
      ...configurationResult,
      shouldRunDev: false, // React Native needs additional manual steps to configure the project
    };
  },
  postConfigure: async ({ packageManager }) => {
    reactNativeWebGeneratorModule.postConfigure({ packageManager });
    reactNativeGeneratorModule.postConfigure({ packageManager });
  },
});
