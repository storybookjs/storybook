import { definePreview } from '../preview-api/modules/addons/definePreview';
import * as addonAnnotations from './preview';

export type { MeasureParameters } from './types';

export default () => definePreview(addonAnnotations);
