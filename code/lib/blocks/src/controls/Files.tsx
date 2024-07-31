import React, { useEffect, useRef } from 'react';
import type { ChangeEvent, FC } from 'react';
import { styled } from 'storybook/internal/theming';
import { Form } from 'storybook/internal/components';

import type { ControlProps } from './types';
import { getControlId } from './helpers';

export interface FilesControlProps extends ControlProps<string[]> {
  /**
   * The accept attribute value is a string that defines the file types the file input should accept. This string is a comma-separated list of unique file type specifiers.
   * @example
   * *\/*
   * @example
   * .webm,video/webm
   * @example
   * .doc,.docx,application/msword
   * @defaultValue `image/*`
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#accept
   */
  accept?: string;
}

const FileInput = styled(Form.Input)({
  padding: 10,
});

function revokeOldUrls(urls: string[]) {
  urls.forEach((url) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}

export const FilesControl: FC<FilesControlProps> = ({
  onChange,
  name,
  accept = 'image/*',
  value,
  argType,
}) => {
  const inputElement = useRef<HTMLInputElement>(null);
  const readonly = argType?.control?.readOnly;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      return;
    }
    const fileUrls = Array.from(e.target.files).map((file) => URL.createObjectURL(file));
    onChange(fileUrls);
    revokeOldUrls(value);
  }

  // Added useEffect hook to reset the file value when value is null
  useEffect(() => {
    if (value == null && inputElement.current) {
      inputElement.current.value = null;
    }
  }, [value, name]);

  return (
    <FileInput
      ref={inputElement}
      id={getControlId(name)}
      type="file"
      name={name}
      multiple
      disabled={readonly}
      onChange={handleFileChange}
      accept={accept}
      size="flex"
    />
  );
};
