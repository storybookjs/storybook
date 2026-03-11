import { type RefObject } from 'react';

import {
  type AriaLandmarkProps,
  type LandmarkAria,
  useLandmark as useUpstream,
} from '@react-aria/landmark';
import type { FocusableElement } from '@react-types/shared';

export function useLandmark(
  props: AriaLandmarkProps,
  ref: RefObject<FocusableElement | null>
): LandmarkAria & { landmarkProps: { 'data-sb-landmark': true } } {
  const { landmarkProps } = useUpstream(props, ref);

  return {
    landmarkProps: {
      ...landmarkProps,
      'data-sb-landmark': true,
    },
  };
}
