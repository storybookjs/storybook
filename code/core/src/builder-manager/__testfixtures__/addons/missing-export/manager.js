import { addons, anExportOfAnotherStorybookVersion } from 'storybook/manager-api';

addons.register('missing-export', () => anExportOfAnotherStorybookVersion);
