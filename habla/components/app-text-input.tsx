import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

/** TextInput with clipboard paste enabled (long-press context menu). */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(
  { contextMenuHidden = false, selectTextOnFocus = false, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      contextMenuHidden={contextMenuHidden}
      selectTextOnFocus={selectTextOnFocus}
      {...props}
    />
  );
});
